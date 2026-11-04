# 认证设计

日期：2026-11-04。配套文档：[IMPLEMENTATION_DESIGN.md](IMPLEMENTATION_DESIGN.md)、[MIGRATION_PLAN.md](MIGRATION_PLAN.md)、[TASK_BREAKDOWN.md](TASK_BREAKDOWN.md)。

阶段 4 才改认证代码。阶段 2 的 `session.hash` 列保持现状，让现有轮换逻辑先在 Prisma 上跑通。

## 1. 现状与要补的缺口

现有实现（[src/auth/auth.service.ts](../../src/auth/auth.service.ts)、[src/session/infrastructure/persistence/relational/repositories/session.repository.ts](../../src/session/infrastructure/persistence/relational/repositories/session.repository.ts)）：

- Access Token 是 HS256 JWT，载荷 `{ id, role, sessionId }`，密钥 `AUTH_JWT_SECRET`，有效期 `AUTH_JWT_TOKEN_EXPIRES_IN`（示例 15 分钟）。
- Refresh Token 也是 JWT，载荷 `{ sessionId, hash }`，密钥 `AUTH_REFRESH_SECRET`，有效期 30 天。`hash` 是 `sha256(randomStringGenerator())`，明文不落库，但 JWT 本身带着这份 hash。
- 刷新时执行 `UPDATE session SET hash = 新值 WHERE id = ? AND hash = 旧值`。影响行数为 0 则 401。旧 refresh 不能再用，但不会撤销该用户的其他会话，也没有“已消费”记录。
- `JwtStrategy` 不读库。登出或删会话之后，Access Token 在过期前仍然有效。
- 改密码会软删除除当前会话以外的会话。重置密码会软删除该用户全部会话，但和密码更新不在同一个事务里。
- `DELETE /api/v1/auth/me` 只软删除用户，不撤销会话。
- 登录不检查 `status`。未确认邮箱可以登录，e2e 固定了这个行为。本轮不改。
- 没有应用内限流。传输方式只有 `Authorization: Bearer`，响应体返回 `refreshToken`。

## 2. 目标模型

两种客户端共用同一套服务端会话：

| 客户端 | Access Token | Refresh Token | 本轮是否实现 |
| --- | --- | --- | --- |
| 移动端、桌面端 | `Authorization: Bearer` | 响应体字段 `refreshToken`，由平台安全存储保存 | 是，默认 |
| Web | 内存中的 Bearer，或短期不落 `localStorage` | `HttpOnly` Cookie | 是，请求头 `x-auth-mode: cookie` 且 `AUTH_COOKIE_ENABLED=true` |

PostgreSQL 是会话是否有效的权威来源。Redis 只做 Access Token 剩余寿命内的撤销缓存和限流计数。

### 2.1 `session`

阶段 4 替换阶段 2 的 `session` 表。没有存量会话需要保留，用一次迁移删表重建即可。

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` 主键，`gen_random_uuid()` | 不再用自增整数。新 Access Token 的 `sessionId` 是这个 uuid |
| `userId` | `int NOT NULL` | 外键 `user.id`，`ON DELETE CASCADE` |
| `deviceName` | `varchar` 可空 | 登录 DTO 可选 |
| `deviceType` | `varchar` 可空 | `web`、`ios`、`android`、`desktop` 之一，DTO 用枚举校验 |
| `userAgent` | `varchar` 可空 | 服务端从请求头截断写入，最长 512 |
| `ip` | `varchar` 可空 | 只记登录当次，不作为安全判断的唯一依据 |
| `createdAt` | `timestamptz` | |
| `lastUsedAt` | `timestamptz` | 每次成功刷新更新 |
| `expiresAt` | `timestamptz` | 等于刷新令牌的绝对过期时间 |
| `revokedAt` | `timestamptz` 可空 | 非空即失效 |
| `revokeReason` | `varchar` 可空 | `logout`、`logout_all`、`password_change`、`password_reset`、`reuse`、`admin`、`user_deleted` |

不再有 `hash` 和 `deletedAt`。一个 Session 就是一个刷新令牌家族：重用检测撤销的是这一行，不是单独再设 `tokenFamilyId`。

### 2.2 `refresh_token`

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` 主键 | |
| `sessionId` | `uuid NOT NULL` | 外键，`ON DELETE CASCADE` |
| `tokenHash` | `varchar(64) NOT NULL` | `HMAC-SHA256(AUTH_REFRESH_SECRET, token)` 的十六进制。唯一索引 |
| `issuedAt` | `timestamptz` | |
| `expiresAt` | `timestamptz` | |
| `consumedAt` | `timestamptz` 可空 | 成功轮换时写入 |
| `revokedAt` | `timestamptz` 可空 | 会话撤销时批量写入 |
| `replacedById` | `uuid` 可空 | 指向下一条 refresh，便于审计 |

令牌本体是 32 字节 `crypto.randomBytes`，base64url 编码后交给客户端。数据库和日志都不存明文。这替换掉“refresh JWT 里夹着 hash”的做法：服务端密钥泄露时，旧模型的 refresh JWT 仍可被伪造；新模型的随机串无法从库里的 HMAC 反推。

### 2.3 `auth_audit_event`

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid` 主键 | |
| `type` | `varchar NOT NULL` | 见下表 |
| `userId` | `int` 可空 | 登录失败且用户不存在时为空 |
| `sessionId` | `uuid` 可空 | |
| `ip` | `varchar` 可空 | |
| `userAgent` | `varchar` 可空 | |
| `metadata` | `jsonb` 可空 | 禁止放入令牌、密码、Cookie |
| `createdAt` | `timestamptz` | |

事件类型：`login_succeeded`、`login_failed`、`refresh_succeeded`、`refresh_reused`、`logout`、`logout_all`、`password_changed`、`password_reset`、`email_confirmed`、`session_revoked`、`user_deleted`。

审计写入和业务写入放在同一个事务里。审计失败则业务回滚。不做异步投递，避免“密码已改但没有审计”。

## 3. 令牌

### 3.1 Access Token

保持 HS256，载荷字段名不变：`{ id, role, sessionId }`。变化只有两处：

- `sessionId` 从整数变为 uuid 字符串。没有存量令牌需要兼容。
- 头部增加 `kid`。验签时先用 `kid` 选密钥；没有 `kid` 的旧令牌直接 401，用来实现“上线后必须重新登录”。

密钥列表：

- 当前密钥：`AUTH_JWT_SECRET`，签发只用它，`kid` 固定为 `current`，或为 `AUTH_JWT_SECRET_KID`。
- 先前密钥：`AUTH_JWT_PREVIOUS_SECRETS`，格式 `kid:secret,kid:secret`。只用于验证，不用于签发。轮换步骤是先把旧密钥放进 previous，再替换 current。观察一个 Access TTL 之后清掉 previous。

生产环境继续拒绝占位密钥（现有 `checkPlaceholderSecrets`）。`AUTH_REFRESH_SECRET` 改作 HMAC 密钥，仍禁止使用示例值。

### 3.2 不再使用的东西

- `JwtRefreshStrategy` 和 refresh JWT 载荷 `{ sessionId, hash }`。
- `passport-jwt` 在刷新接口上的用法。改为 `RefreshTokenGuard`：从 `Authorization: Bearer` 或 Cookie `refresh_token` 取不透明串，不验证 JWT 签名。
- Access Token 策略仍用 Passport `jwt`，在 `validate` 里增加撤销检查。

## 4. 刷新流程

整个流程包在一个 Prisma 事务里。

1. 计算 `tokenHash`。按唯一索引查出 `refresh_token`，带上 `session`。
2. 不存在、已过期、session 已撤销、refresh 已撤销：401，不写审计以外的状态。过期与不存在对外都是同一个 401 文案，不区分。
3. `consumedAt` 已有值：判定为重用。把该 session 的 `revokedAt`、`revokeReason = reuse` 写入，该 session 下未消费的 refresh 全部 `revokedAt = now()`，写 `refresh_reused`，然后 401。
4. 宽限期内的例外：`AUTH_REFRESH_REUSE_GRACE_SECONDS` 默认 `0`。若大于 0，且 `consumedAt` 距离现在不超过该秒数，并且 `replacedById` 指向的下一条尚未被消费，则不撤销，返回 401 让客户端改用它已经拿到的新令牌。默认 0 表示严格单次使用。Web 多标签页同时刷新若成为实际问题，再把这个值调到 5 到 10 秒，并补测试。
5. 条件更新：`updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now(), replacedById } })`。要求 `count === 1`。`count === 0` 按重用处理（并发的另一个请求已经消费）。
6. 插入新的 `refresh_token`，更新 `session.lastUsedAt`，写 `refresh_succeeded`。
7. 只返回新的 Access Token 和新的 Refresh Token。Bearer 模式响应体字段保持 `token`、`refreshToken`、`tokenExpires`。Cookie 模式不在响应体放 `refreshToken`。

并发：两个请求带着同一个 refresh 进入时，条件更新保证只有一个 `count === 1`。另一个走重用分支并撤销整个 session。测试用 `Promise.all` 发两个刷新，断言恰好一个 200、一个 401，且随后旧令牌和新令牌都无法再刷新（被撤销的 session）。这是比现状更严的行为：现状下失败的那个只是 401，成功的那个仍然有效。文档和 e2e 要写明。

## 5. 撤销与 Access Token

撤销 session 时同时 `SET` Redis 键 `auth:revoked-session:{sessionId}`，TTL 等于 Access Token 的有效期秒数。值是撤销原因，不含用户数据。

`JwtStrategy.validate`：

1. 若 `AUTH_SESSION_CHECK=false`，保持现状，只校验 JWT。默认 `true`。
2. Redis 命中撤销键：401。
3. Redis 未命中：再查 PostgreSQL 的 `session.revokedAt` 与 `expiresAt`。已撤销或不存在：401，并回填 Redis。
4. Redis 连接失败：回退到 PostgreSQL，不把缓存故障变成“全部放行”。回退记一条 warn。

这是有意的语义变化：登出后 Access Token 立即失效，每个受保护请求多一次 Redis 读，Redis 故障时多一次数据库读。开关默认开启。e2e 增加“logout 之后用旧 access 得到 401”。

联动：

| 动作 | 撤销范围 | 与现状比 |
| --- | --- | --- |
| `POST /auth/logout` | 当前 session | 相同，但从软删除改为 `revokedAt`，并立即使 access 失效 |
| `POST /auth/logout/all` | 该用户全部 session | 新接口 |
| `PATCH /auth/me` 改密码 | 除当前 session 外全部 | 相同 |
| `POST /auth/reset/password` | 全部，且与密码更新同一事务 | 补上事务 |
| `DELETE /auth/me`、管理员删除用户 | 全部 | 新行为 |
| refresh 重用 | 该 session | 新行为 |

`GET /api/v1/auth/sessions` 返回当前用户未撤销的会话：`id`、`deviceName`、`deviceType`、`createdAt`、`lastUsedAt`、`expiresAt`、`current`。不返回 hash、ip 全量可省略或只返回脱敏后的前缀。

`DELETE /api/v1/auth/sessions/:id` 撤销自己的一个会话。撤销当前会话等价于 logout。

`DELETE /api/v1/users/:id/sessions` 仅管理员，撤销目标用户全部会话。

登录 DTO 增加可选 `deviceName`、`deviceType`。不传则两列为空。现有客户端不传也能登录。

## 6. Cookie 与 CSRF

开关：`AUTH_COOKIE_ENABLED`。关闭时忽略 `x-auth-mode`，行为与纯 Bearer 完全一致，供尚未准备 CSRF 的部署使用。

开启且请求头 `x-auth-mode: cookie`：

- 登录和刷新的响应设置 `refresh_token` Cookie：`HttpOnly`、`Secure`（非 production 可关 Secure，仅当 `NODE_ENV !== production`）、`SameSite` 来自 `AUTH_COOKIE_SAMESITE`（默认 `Lax`；跨站前端必须 `None` 且 `Secure`）、`Path=/api/v1/auth`、`Max-Age` 与 refresh 有效期一致。
- 同时设置 `csrf_token` Cookie：非 `HttpOnly`，`SameSite` 与 refresh 相同，`Path=/`，值是 32 字节随机串。
- 响应体不包含 `refreshToken`。仍包含 `token` 和 `tokenExpires`，Access Token 不进 Cookie。
- 刷新、登出、登出全部这些会消费 refresh 的请求，必须带 `X-CSRF-Token`，且与 `csrf_token` Cookie 常量时间比较相等。另外 `Origin` 必须落在 `APP_CORS_ORIGINS` 白名单。缺一不可，失败 403。
- 登录本身是 Bearer 或 JSON 体发起的，不要求 CSRF。登录响应下发 CSRF Cookie。

CORS：Cookie 模式要求 `credentials: true`。配置校验在 `AUTH_COOKIE_ENABLED=true` 或 `NODE_ENV=production` 时拒绝 `APP_CORS_ORIGINS` 含 `*`。否则浏览器会拒绝带凭证的跨域响应，这个组合不能作为可运行配置。

依赖：`cookie-parser`，在 `main.ts` 注册。不手写 Cookie 解析。

Web 客户端不把 refresh 放进 `localStorage`。这条写进文档，服务端无法强制。

## 7. 限流

`@nestjs/throttler` 6.7.1。存储用项目内的 Redis 实现（`ThrottlerStorage` 约一个小类），不先引入未核对 peer 的第三方存储包。`@nest-lab/throttler-storage-redis@1.2.0` 仅作备选，接入前要核对它与 throttler 6 的接口。

只包这些路由，不包全局：

- `POST /api/v1/auth/email/login`
- `POST /api/v1/auth/email/register`
- `POST /api/v1/auth/forgot/password`
- `POST /api/v1/auth/reset/password`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/apple/login`、`google/login`、`facebook/login`

默认限额写在配置里，起点是每 IP 每分钟 10 次。e2e 环境把限额调到不会误伤套件的值，并用单独用例把限额降到 2 以断言 429。

登录失败另计 `auth:login-fail:{email}:{ip}`，窗口 15 分钟，阈值 10。达到阈值后该组合直接 429，即使用户随后输对密码。计数在 Redis，过期即消失，不写用户表。

`AUTH_UNIFORM_ERRORS` 的生产示例改为 `true`。限流和统一错误一起做，避免忘记密码接口在无限流时泄露邮箱是否存在。

## 8. 邮件令牌

确认邮箱和重置密码的 JWT 算法、载荷、密钥派生保持不变：

- 确认邮箱：`{ confirmEmailUserId }`，密钥 `AUTH_CONFIRM_EMAIL_SECRET`
- 新邮箱：`{ confirmEmailUserId, newEmail }`，同一密钥
- 重置密码：`{ forgotUserId }`，密钥是 `AUTH_FORGOT_SECRET` 拼接当前密码哈希

阶段 3 把发信挪到 Worker 之后，这三枚 JWT 由 Worker 在发送前签发，而不是由 API 签好再放进队列。重置链接“改密后失效”的语义因此还在：密钥仍依赖当前密码哈希。队列载荷只有 `{ kind, userId, lang, newEmail? }`。

## 9. 兼容与上线

| 面 | 决定 |
| --- | --- |
| Bearer 登录响应字段 | `token`、`refreshToken`、`tokenExpires`、`user` 保持 |
| 刷新响应字段 | Bearer 模式保持三字段；Cookie 模式去掉 `refreshToken` |
| 旧 refresh JWT | 一律 401。上线即强制重新登录。没有存量用户 |
| 未确认邮箱登录 | 保持允许，不改现有 e2e |
| Access 在登出后 | 默认立即失效。这是唯一需要客户端感知的行为变化，写进发布说明 |
| `sessionId` 类型 | 新令牌里是 uuid。客户端若把 sessionId 当数字解析，需要改。仓库内的前端不在本仓库 |

不在本轮做的：

- 不把 Access Token 改成 Cookie。
- 不引入 `iss` / `aud`。单服务样板维持现状；多受众时再加。
- 不把 bcrypt 换成 Argon2。
- 不在 `JwtStrategy` 里每次重读角色。角色变更的生效窗口仍是 Access TTL，刷新时会从数据库重读。若要立即生效，另开任务。

## 10. 测试矩阵

单元测试用假的 session / refresh 仓储和假的 Redis：

- 轮换后旧 hash 找不到，新 hash 能找到
- 已消费令牌第二次出现会撤销 session
- 条件更新 `count === 0` 走重用分支
- 宽限配置为 0 时没有例外
- 登出写入撤销原因 `logout`

e2e（真实 PostgreSQL 与 Redis）：

- 登录、带 access 访问 `GET /auth/me`、刷新、再用新 refresh 刷新
- 同一个 refresh 第二次使用得到 401，且该 session 的后续 access 也 401
- `Promise.all` 双刷新：一个 200，一个 401，其后两个令牌都不可用
- 两个设备登录，撤销其中一个，另一个仍可刷新
- `logout/all` 之后两个 access 都 401
- 改密码后旧会话的 refresh 401，当前会话仍可用
- 重置密码后全部会话 401，且密码更新与会话撤销同时可见（中途失败用例用仓储假对象测事务，e2e 测成功路径）
- `DELETE /auth/me` 之后旧 access 401
- Cookie 模式：登录响应含 `Set-Cookie` 且 JSON 无 `refreshToken`；无 `X-CSRF-Token` 的刷新得到 403；带头和 Cookie 的刷新得到 200
- 限流用例得到 429
- 日志夹具断言输出不含 `refreshToken`、密码和 `Authorization`
