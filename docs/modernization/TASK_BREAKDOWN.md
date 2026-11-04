# 任务拆分

日期：2026-11-04。实施时以本清单为准。设计依据见 [IMPLEMENTATION_DESIGN.md](IMPLEMENTATION_DESIGN.md)、[MIGRATION_PLAN.md](MIGRATION_PLAN.md)、[AUTH_DESIGN.md](AUTH_DESIGN.md)。

每个任务开始前说明目标、文件、是否影响数据库 / API / 认证、风险和回滚。结束后列出改动文件、依赖变化、实际执行的命令和结果、未解决问题，并更新本清单的状态。禁止只写“已完成”。

阶段结束打 tag：`modernization/stage-1` 到 `modernization/stage-7`。上一阶段验收不绿，不开始下一阶段。标了“人工确认”的任务，确认前不执行。

验收命令在阶段 5 之前用 pnpm 调用现有 Jest。阶段 5 之后改为 Vitest，任务卡里写的 `pnpm test` 保持为包脚本名，脚本内容在 T5.4 替换。

## 阶段 1：pnpm 与 Nest 11 基线

前置：阶段 0 文档已审阅。不改业务行为。

### T1.1 固定 pnpm 并写 `.npmrc`

- 目标：选定 pnpm 10.34.9，打开严格 peer，关闭自动安装 peer，构建脚本走白名单。
- 文件：`.npmrc`，`package.json` 的 `packageManager` 与 `pnpm.onlyBuiltDependencies`。
- 兼容性：不改数据库、API、认证。
- 风险：现有依赖树在严格 peer 下安装失败。回滚：删掉 `.npmrc` 相关行。
- 验收：`corepack pnpm@10.34.9 install` 完成且不靠放宽 peer。
- 人工确认：否。

### T1.2 改脚本和钩子

- 目标：`package.json` scripts、`.husky/pre-commit`、`.husky/commit-msg` 中的 `npm` / `npx` 改为 pnpm。`engines.node` 改为 `>=20.19.0`，去掉 `engines.npm`。
- 文件：`package.json`，`.husky/*`。
- 兼容性：无。
- 风险：钩子在没有 corepack 的环境失败。回滚：恢复脚本。
- 验收：`pnpm run lint`，`pnpm test`（允许 `--passWithNoTests` 直到阶段 2 有单元测试）。
- 前置：T1.1。人工确认：否。

### T1.3 重新生成锁文件并干净安装

- 目标：删除 `node_modules` 后用 pnpm 安装，生成新的 `pnpm-lock.yaml`。不沿用现有未跟踪锁文件。
- 文件：`pnpm-lock.yaml`。
- 兼容性：无。
- 风险：幽灵依赖导致编译失败。回滚：恢复 `node_modules` 的 npm 安装（`package-lock.json` 仍在）。
- 验收：`pnpm install --frozen-lockfile`，`pnpm run build`，`pnpm run lint`，关系型 e2e（`pnpm run test:e2e:relational:docker` 或等价的本地库命令）。
- 前置：T1.2。人工确认：否。

### T1.4 CI 与 Docker 改用 pnpm

- 目标：`.github/workflows/cli.yml`、`.github/workflows/docker-e2e.yml`、各 Dockerfile、`startup.relational.*.sh` 使用 corepack pnpm。此任务不改成多阶段、不改成非 root，那是 T7.1。
- 文件：上述 workflow、`Dockerfile`、`relational.e2e.Dockerfile`、`relational.test.Dockerfile`、`startup.relational.dev.sh`、`startup.relational.ci.sh`、`startup.relational.test.sh`。
- 兼容性：无。document 相关文件留到 T2a.1 再删，本任务若仍会构建 document 镜像，那些 Dockerfile 也要能安装，否则 CI 在阶段 2a 之前就是红的。
- 风险：CI 缓存键仍指向 npm。回滚：恢复 workflow。
- 验收：相关 workflow 的安装步骤在本地用同样的 compose 命令跑通关系型 e2e。
- 前置：T1.3。人工确认：否。

### T1.5 删除 npm 锁文件

- 目标：删除 `package-lock.json`，`.gitignore` 忽略它，避免再提交。
- 文件：`package-lock.json`，`.gitignore`。
- 兼容性：无。
- 风险：pnpm 安装并没有真正可复现。回滚：从 tag 之前的提交恢复锁文件。
- 验收：T1.3 的命令在删除之后再跑一次 frozen install。
- 前置：T1.3 与 T1.4 已绿。人工确认：是。

### T1.6 可选：Nest 11 补丁与安全依赖

- 目标：按 `docs/audit/DEPENDENCY_UPGRADE_PLAN.md` 第一批升级。至少包括 `@nestjs/*` 11.1.18 → 11.2.8（config 留在 4.0.x 的补丁）、`nodemailer`、`multer`、`handlebars`、`pg`。不升 Nest 12，不升 TypeORM 1。TypeORM 若仍低于 0.3.31，补到 0.3.31，因为阶段 2 之前它还在运行。
- 文件：`package.json`，`pnpm-lock.yaml`。
- 兼容性：不改 API。nodemailer 8 到 10 要对照 `MailerService` 的 `createTransport` / `sendMail`。
- 风险：Express 传递升级改变错误码。回滚：锁回该包的上一版本，不跳过失败测试。
- 验收：`pnpm run build`，`pnpm run lint`，关系型 e2e，document e2e（Mongo 还在）。`pnpm audit --prod` 的直接告警与升级前对比，剩下的条目写进 PR。
- 前置：T1.5。人工确认：否，但是单独提交，不和 T1.5 混在一起。可以整项跳过，跳过要在清单里写明。

## 阶段 2a：删除 MongoDB

前置：阶段 1 tag。没有文档库部署的确认。

### T2a.1 删除文档库路径

- 目标：运行时只剩 PostgreSQL + TypeORM。id 在领域类型上收窄为 `number`。
- 文件：`MIGRATION_PLAN.md` 第 2 节的删除表。包含 `src/**/document/**`、`env-example-document`、document compose / Dockerfile / startup、`.hygen` 的 document 与 all-db 模板、`package.json` 里对应脚本、`.github/workflows` 里的 document job、`mongoose` 相关依赖。
- 兼容性：`DATABASE_TYPE=mongodb` 不再可用。关系库 API、JWT 字段、422 体不变。
- 风险：仓库外仍有人用 document 环境。回滚：回到 `modernization/stage-1`。
- 验收：`pnpm run build`，`pnpm run lint`，关系型 e2e，`pnpm run test:generators:relational`。全仓库检索不到 `isDocumentDatabase`、`@nestjs/mongoose`、`mongoose`。
- 人工确认：是。

## 阶段 2b：Prisma 替换 TypeORM

前置：阶段 2a tag。细节以迁移方案为准。

### T2b.1 补对照 e2e

- 目标：在换 ORM 之前把现有行为钉住。
- 文件：`test/user/auth.e2e-spec.ts`，`test/admin/users.e2e-spec.ts`（排序用例）。
- 用例：logout 后当前 refresh 不可用（此阶段 access 仍可用到过期，与现状一致）；并发注册第二笔得到 422 `emailAlreadyExists`；`orderBy` 非法值得到 422。最后一条若现状是 500，先改校验再写 e2e，算本任务的一部分，不留到阶段 6。
- 兼容性：非法排序从 500 变为 422。其余 API 不变。
- 风险：并发用例在慢库上不稳定。回滚：删除新增用例。
- 验收：新用例在 TypeORM 上先绿。
- 人工确认：否。

### T2b.2 Prisma schema 与模块

- 目标：加入迁移方案第 4 节的 schema、`prisma.config.ts`、`PrismaModule`。generator 先用 `moduleFormat = "cjs"`。
- 文件：`prisma/schema.prisma`，`prisma.config.ts`，`src/database/prisma.module.ts`，`src/database/prisma.service.ts`，`.gitignore`。
- 依赖：`prisma@7.10.1`、`@prisma/client@7.10.1`、`@prisma/adapter-pg@7.10.1`。`pg` 保留。
- 兼容性：尚未切换运行时，API 不变。
- 风险：生成目录被提交。回滚：删除上述文件和依赖。
- 验收：`pnpm exec prisma validate`，`pnpm exec prisma generate`，`pnpm run build`。
- 人工确认：否。

### T2b.3 初始迁移与结构对比

- 目标：生成 `prisma/migrations/0_init`，在临时空库 `migrate deploy`，与 TypeORM 迁移建出的库做 schema diff。只允许迁移方案第 4.1 节的差异。
- 文件：`prisma/migrations/0_init/migration.sql`，对比说明写进 PR，不另开文档，除非差异超出第 4.1 节。
- 兼容性：只影响新库。不对本机日常库执行。禁止 `migrate reset`。
- 风险：对照库缺少 `uuid-ossp` 导致 TypeORM 侧建库失败。只在对照库创建扩展，并写入对比说明。
- 验收：`prisma migrate diff --from-migrations --to-schema` 无输出；schema diff 记录附在 PR。
- 前置：T2b.2。人工确认：否。对非临时库执行则需要确认。

### T2b.4 Prisma 仓储与单元测试

- 目标：`users`、`session`、`files` 的 Prisma 仓储和 mapper。端口方法签名保持，读方法显式 `deletedAt: null` 和 `userWithRelations`。
- 文件：`src/*/infrastructure/persistence/prisma/**`，`src/*/infrastructure/persistence/*.repository.ts`，对应 `*.spec.ts`。模块改为提供 Prisma 适配器。TypeORM 适配器先留在树上，直到 T2b.7。
- 兼容性：运行时改为 Prisma。响应字段不变。
- 风险：eager 改显式 include 后漏加载 `role`，登录签发的 JWT 没有角色。回滚：模块切回 TypeORM 适配器。
- 验收：仓储单元测试；T2b.1 的 e2e 与原有关系型 e2e。
- 前置：T2b.3。人工确认：否。

### T2b.5 事务、唯一冲突、排序

- 目标：`PrismaService.runInTransaction`；重置密码的更新密码与删除会话同一事务；`P2002` 映射为 422 `emailAlreadyExists`；排序白名单与 T2b.1 的校验一致。
- 文件：`src/database/prisma.service.ts`，`src/auth/auth.service.ts`，`src/users/users.service.ts`，仓储。
- 兼容性：并发注册的错误码从 500 变为现有业务码 422。成功路径的响应不变。
- 风险：事务边界漏了审计或邮件。此阶段邮件仍是同步发送，放在事务提交之后，避免事务持有 SMTP。
- 验收：单元测试覆盖 `P2002` 和事务回滚（第二步失败时密码未改）；e2e 并发注册。
- 前置：T2b.4。人工确认：否。

### T2b.6 种子

- 目标：`prisma/seed.ts` 用 upsert。普通用户的角色名写 `User`，不照抄现种子里错误的 `role.name: 'Admin'`。
- 文件：`prisma/seed.ts`，`prisma.config.ts`，删除或停止使用 `src/database/seeds/relational` 的运行入口（文件可留到 T2b.7 一起删）。
- 兼容性：开发数据。`john.doe@example.com` 的角色名以 `role` 表为准，为 `User`。
- 风险：生产启动仍调用旧 seed。回滚：恢复旧 seed 脚本。
- 验收：连续执行两次 seed 不产生重复行；admin 与 user 各一条。
- 前置：T2b.3。人工确认：否。

### T2b.7 删除 TypeORM

- 目标：满足迁移方案第 8 节的四条退出条件后，删除 TypeORM 依赖、实体、`data-source.ts`、旧迁移脚本。旧迁移复制到 `docs/modernization/archive/`。
- 文件：迁移方案第 8 节的删除清单，以及 `package.json` scripts。
- 兼容性：无新增 API 变化。
- 风险：还有文件引用 `typeorm`。回滚：回到本任务之前的提交。不要用反向 SQL 当回滚。
- 验收：`rg typeorm src test package.json` 无运行时引用；`pnpm run build`；单元测试；关系型 e2e；漂移检查无输出。
- 前置：T2b.4、T2b.5、T2b.6。人工确认：是。

## 阶段 3：Redis、BullMQ、日志、健康检查

前置：阶段 2b tag。版本按实施设计第 5 节。

### T3.1 Redis 模块

- 目标：`REDIS_URL` 配置与校验，`RedisModule` 在销毁时 `quit`。
- 文件：`src/cache/**`，`src/config/**`，`env-example-relational`。删除 `WORKER_HOST`。
- 依赖：`ioredis@5.11.1`。
- 兼容性：新增环境变量。不配则启动失败，避免静默退化。
- 风险：本地 compose 没有 Redis。回滚：移除模块。
- 验收：单元测试 mock 连接；有 Redis 时应用能启动并在关闭时断开。
- 人工确认：否。

### T3.2 结构化日志

- 目标：`nestjs-pino`，请求 id，实施设计第 7.3 节的脱敏。
- 文件：`src/main.ts`，`src/app.module.ts`，日志配置。
- 依赖：`nestjs-pino@5.3.1`、`pino@10.4.0`、`pino-http@11.0.0`。
- 兼容性：日志格式变化，HTTP 响应不变。
- 风险：脱敏漏了 `set-cookie`。验收夹具要覆盖。
- 验收：`pnpm run build`；测试或脚本断言日志样本不含密码和 `Authorization`。
- 前置：无，可与 T3.1 并行。人工确认：否。

### T3.3 队列与 Worker 入口

- 目标：`BullModule`、`src/worker.ts`、`src/worker.module.ts`。API 只生产，Worker 只消费。先接一个会写日志的空 mail consumer，证明链路，再在 T3.4 接 SMTP。
- 文件：`src/queue/**`，`src/worker.ts`，`src/workers/mail/**`，`package.json` 的 `start:worker`。
- 依赖：`bullmq@6.6.0`、`@nestjs/bullmq@11.0.5`。
- 兼容性：无，直到 T3.4 改变发信时机。
- 风险：阶段 0 的 spike 只证明了 import，没有连上 Redis。本任务是运行门禁。
- 验收：向 Redis 投入一条 job，Worker 日志出现该 `jobId`。
- 前置：T3.1、T3.2。人工确认：否。

### T3.4 邮件改为入队

- 目标：注册、忘记密码、更改邮箱改为入队。载荷只有 `kind`、`userId`、`lang`、可选 `newEmail`。Worker 内签发原有三种 JWT 再发信。
- 文件：`src/auth/auth.service.ts`，`src/mail/mail.service.ts`，`src/workers/mail/**`。
- 兼容性：HTTP 仍返回原来的 204。邮件到达变异步。链接的查询参数和密钥语义不变。
- 风险：Worker 未运行时用户收不到信，接口却返回成功。开发 compose 必须同时启动 Worker。回滚：API 恢复直接调用 `MailService`。
- 验收：e2e 在轮询 maildev 后仍能取到确认信和重置信；队列载荷夹具不含 `hash` 和 JWT。
- 前置：T3.3。人工确认：否。

### T3.5 重试、幂等、失败

- 目标：按实施设计第 7.2 节的表格配置重试、退避、`jobId`、并发、超时和保留期。
- 文件：队列注册处与 Worker。
- 兼容性：无。
- 风险：`jobId` 时间桶太粗，用户一分钟内收不到第二封合法邮件。桶宽 60 秒写进文档。
- 验收：单元测试断言重复 `jobId` 不产生第二个 job；失败路径写 error 日志且不含 `newEmail`。
- 前置：T3.4。人工确认：否。

### T3.6 健康检查

- 目标：`GET /api/health/live` 与 `GET /api/health/ready`。ready 检查 Prisma 与 Redis。响应不包含连接串。
- 文件：`src/health/**`，`src/main.ts` 的前缀排除或控制器路径。
- 依赖：`@nestjs/terminus@12.1.0`。
- 兼容性：新增路由。`GET /` 保留。
- 风险：探针被版本前缀挡成 404。验收要打真实路径。
- 验收：依赖可用时 ready 为 200；Redis 停掉时 ready 非 200，live 仍为 200。
- 前置：T3.1、T2b.7。人工确认：否。

### T3.7 e2e 启动 Worker

- 目标：关系型测试脚本在 API 之外启动 Worker，邮件断言改为轮询 maildev。
- 文件：`test/user/auth.e2e-spec.ts`，`startup.relational.test.sh`，`docker-compose.relational.test.yaml`。
- 兼容性：测试专用。
- 风险：轮询超时太短导致 CI 抖动。超时写明，失败时打印 Worker 日志。
- 验收：`pnpm run test:e2e` 在带 Postgres、Redis、maildev 的环境通过。
- 前置：T3.4。人工确认：否。

## 阶段 4：认证

前置：阶段 3 tag。行为以认证设计为准。这是 API 语义变化最大的阶段。

### T4.1 表结构迁移

- 目标：替换 `session`，新增 `refresh_token`、`auth_audit_event`。空库直接迁移，不迁移旧 hash。
- 文件：`prisma/schema.prisma`，新的 migration 目录。
- 兼容性：旧的 refresh JWT 在代码切换后全部 401。`sessionId` 变为 uuid。
- 风险：把这次迁移和阶段 2 的 `0_init` 揉成一次重写，导致已发布的阶段 2 迁移对不上。必须是新的 migration 目录。回滚：回到阶段 3 tag，测试库重建。
- 验收：`migrate deploy` 从空库执行到最新；漂移检查无输出。
- 人工确认：是。

### T4.2 刷新轮换与重用检测

- 目标：不透明 refresh、HMAC 存储、事务内条件更新、重用则撤销整个 session。宽限默认 0。
- 文件：`src/auth/**`，`src/session/**`。删除 `JwtRefreshStrategy` 的刷新职责。
- 兼容性：Bearer 响应字段名不变。并发双刷新变为“一个成功并随后整个 session 作废”，与现状不同，e2e 按认证设计第 4 节改。
- 风险：HMAC 密钥沿用了可以被伪造的 JWT 密钥却没换生成方式。验收要断言库里没有明文 token。
- 验收：认证设计第 10 节的单元测试条目。
- 前置：T4.1。人工确认：否。

### T4.3 撤销缓存

- 目标：撤销时写 `auth:revoked-session:{id}`。`JwtStrategy` 先 Redis 后 PostgreSQL。`AUTH_SESSION_CHECK` 默认 true。
- 文件：`src/auth/strategies/jwt.strategy.ts`，`src/cache/**`。
- 兼容性：登出后 access 立即 401。这是有意变化。
- 风险：Redis 故障被写成放行。测试要覆盖回退读库。
- 验收：停用缓存客户端时仍能拒绝已撤销会话；开启时 logout 后的 access 为 401。
- 前置：T4.2、T3.1。人工确认：否。

### T4.4 会话管理接口

- 目标：`GET /api/v1/auth/sessions`，`DELETE /api/v1/auth/sessions/:id`，`POST /api/v1/auth/logout/all`，管理员 `DELETE /api/v1/users/:id/sessions`。改密码、重置密码、删除用户按认证设计第 5 节联动。登录 DTO 增加可选设备字段。
- 文件：`src/auth/auth.controller.ts`，`src/users/users.controller.ts`，DTO。
- 兼容性：只增路由和可选字段。重置密码的成功响应仍是 204。
- 风险：用户能撤销他人会话。仓储条件必须带 `userId`。
- 验收：认证设计第 10 节里多设备、改密码、重置密码、删除用户的 e2e。
- 前置：T4.2。人工确认：否。

### T4.5 Cookie 与 CSRF

- 目标：`AUTH_COOKIE_ENABLED` 与 `x-auth-mode: cookie`。Cookie 属性、双提交 CSRF、`Origin` 白名单、CORS credentials。启用 Cookie 或生产环境时拒绝 CORS `*`。
- 文件：`src/main.ts`，`src/auth/**`，`src/config/app.config.ts`，`src/auth/config/auth.config.ts`。
- 依赖：`cookie-parser@1.4.7`。
- 兼容性：默认关闭时与 Bearer 完全一致。开启后 Cookie 模式的 JSON 不再含 `refreshToken`。
- 风险：`SameSite=None` 却没 `Secure`。生产配置校验拒绝。
- 验收：认证设计第 10 节的 Cookie 用例；关闭开关时原 Bearer e2e 仍绿。
- 前置：T4.2。人工确认：否。

### T4.6 限流

- 目标：认证设计第 7 节的路由限额和登录失败计数。存储写在 `src/cache`，不新增未核对的存储包。
- 文件：`src/auth/*.controller.ts`，三个社交登录控制器，`src/cache/**`。
- 依赖：`@nestjs/throttler@6.7.1`。
- 兼容性：超限返回 429。e2e 默认限额调高，另有一条调低后断言 429。
- 风险：全局限流误伤健康检查和 e2e。只挂认证路由。
- 验收：429 用例；其余 e2e 不因限额失败。
- 前置：T3.1。人工确认：否。

### T4.7 密钥轮换

- 目标：Access Token 头 `kid`。`AUTH_JWT_PREVIOUS_SECRETS` 只验证不签发。无 `kid` 的 access 返回 401。
- 文件：签发与 `JwtStrategy`，`env-example-relational`。
- 兼容性：阶段 4 上线即重新登录，与 T4.2 同一发布说明。
- 风险：previous 列表被拿来签发。代码审查只允许一处 `signAsync` 使用 current。
- 验收：用 previous 密钥签的、带对 `kid` 的 token 能访问；用 current 签的新 token 能访问；无 kid 的 token 401。
- 前置：T4.3。人工确认：否。

### T4.8 认证测试与发布说明

- 目标：把认证设计第 10 节的矩阵补全，并在 `docs/auth.md` 写强制重新登录、Cookie 模式和 access 立即失效。
- 文件：`test/**/*.e2e-spec.ts`，`src/auth/**/*.spec.ts`，`docs/auth.md`。
- 兼容性：文档。
- 风险：矩阵漏了并发。该用例不可省。
- 验收：`pnpm test` 与 `pnpm run test:e2e`。
- 前置：T4.2 到 T4.7。人工确认：否。

## 阶段 5：ESM

前置：阶段 4 tag。先做 T5.0，不通过则停止本阶段，不把半套 `.js` 后缀留在主分支。

### T5.0 工具链门禁

- 目标：在临时分支验证完整应用，而不是重复阶段 0 的 import spike。必须包括：Nest 启动、`prisma generate`（`moduleFormat = "esm"`）后的构建、对真实 Redis 的一发一收、Vitest 跑一条现有仓储测试、Hygen 在 `"type": "module"` 下是否还能运行。
- 文件：临时分支。结论写回本任务的状态，不新开设计文档。
- 兼容性：无，分支不合并直到后面的任务完成。
- 风险：Hygen 不支持 ESM。处理见 T5.5，不因此否定 ESM。
- 验收：上述四项有命令输出。任何一项失败就停，列出替代，等确认。
- 人工确认：是，确认 spike 结论后再改主线。

### T5.1 编译配置

- 目标：`"type": "module"`，`tsconfig` 使用 `nodenext`，Prisma `moduleFormat` 改为 `esm` 并重新生成。
- 文件：`package.json`，`tsconfig.json`，`tsconfig.build.json`，`nest-cli.json`，`prisma/schema.prisma`。
- 兼容性：运行入口路径可能从 `dist/main` 变为 `dist/main.js`，Docker 在 T5.6 一起改。
- 风险：生成的客户端未编进 `dist`。阶段 0 已证明不能直接跑 `.ts`。
- 验收：`pnpm exec prisma generate && pnpm run build && node dist/main.js` 能启动到监听端口（依赖用测试容器）。
- 前置：T5.0。人工确认：否。

### T5.2 相对导入后缀

- 目标：源码相对导入统一为 `.js`。用一次 codemod，不用手改一半。
- 文件：`src/**/*.ts`，`test/**/*.ts`，`prisma/seed.ts`。
- 兼容性：无。
- 风险：codemod 改了动态字符串或不该改的 `.js` 资源路径。diff 必须人工扫过 `mail-templates` 和 i18n 路径。
- 验收：`pnpm run build`，`pnpm run lint`。
- 前置：T5.1。人工确认：否。

### T5.3 运行时互操作

- 目标：替换剩余 `__dirname`；验证 `bcryptjs`、`ms` 的导入；拆掉任何 ESM 下 TDZ 的循环注入。
- 文件：以 `rg "__dirname|require\\("` 的结果为准。
- 兼容性：无。
- 风险：用 `await import()` 掩盖循环。不允许作为最终写法。
- 验收：`node dist/main.js` 与 `node dist/worker.js` 都通过启动；`rg` 在 `src` 和 `prisma` 没有 `__dirname` 和 `require(`。
- 前置：T5.2。人工确认：否。

### T5.4 测试运行器

- 目标：改为 Vitest 4 + `unplugin-swc`。e2e 继续用 supertest。
- 文件：`package.json`，删除或停止使用 `test/jest-e2e.json` 与 ts-jest 配置，新增 Vitest 配置。
- 依赖：加入 `vitest@4.0.18`、`unplugin-swc@1.5.9`；确认不再使用后移除 `jest`、`ts-jest`、`@types/jest`。
- 兼容性：无。
- 风险：Nest 测试应用在 Vitest 下起不来。退路是 Jest 30 + `@swc/jest` 加 `--experimental-vm-modules`，要在本任务记录原因后才允许退路。
- 验收：`pnpm test` 与 `pnpm run test:e2e`。
- 前置：T5.2。人工确认：否。退回 Jest 时需要确认。

### T5.5 脚本与 Hygen

- 目标：seed、安装脚本改为 `tsx`。Hygen 若不能在 ESM 包里运行，改为用 `tsx` 调用的薄包装，或把 `.hygen.js` 留成 Hygen 能加载的形式并在 T5.0 的结论里写明限制。
- 文件：`package.json` scripts，`.hygen.js`，`.install-scripts/**`。
- 兼容性：无。
- 风险：生成器静默不可用。验收必须真的生成一次再删掉生成物。
- 验收：`pnpm run seed:run:relational` 的替代命令成功；`pnpm run generate:resource:relational` 在临时目录或可回滚的工作区成功，随后清理生成物。
- 前置：T5.1。人工确认：否。

### T5.6 四个启动面

- 目标：开发、测试、`node dist/main.js`、`node dist/worker.js`、`prisma migrate deploy`、阶段 1 留下的 Docker 镜像都能在 ESM 下启动。最终镜像形态仍可等到 T7.1，但当前镜像不能还在执行 `node dist/main` 而无后缀。
- 文件：Dockerfile，`package.json` 的 `start:prod`、`start:worker`。
- 兼容性：无。
- 风险：只验证了 API，忘了 Worker。两个都要有日志。
- 验收：四个命令的输出保留在 PR。
- 前置：T5.3、T5.4、T5.5。人工确认：否。

## 阶段 6：架构清理与安全

前置：阶段 5 tag。

### T6.1 Presenter

- 目标：`User`、`Role`、`Status` 去掉 `@ApiProperty`、`@Exclude`、`@Expose` 和任何配置读取。出参放到 `presenters/`。密码与邮箱的可见性与现在的 groups 一致。
- 文件：`src/users/domain/user.ts`，`src/roles/domain/role.ts`，`src/statuses/domain/status.ts`，新建 `src/users/presenters/**`，控制器的 `SerializeOptions`。
- 兼容性：响应字段集合必须与阶段 5 的 e2e 一致。
- 风险：漏掉 `@Expose` 导致邮箱或密码泄漏。这是本阶段最高风险。
- 验收：e2e 断言 JSON 无 `password`；`GET /auth/me` 含 `email`；管理员列表含 `email`；无分组的响应不含 `email`（与现状对齐，先读现有断言再写，不凭记忆）。
- 人工确认：否。

### T6.2 文件 URL 移出领域

- 目标：`FileType` 不再创建 `S3Client`。`FileUrlService` 在 presenter 或 service 生成 URL。然后删除 `ResolvePromisesInterceptor`，前提是响应里不再有 Promise。
- 文件：`src/files/domain/file.ts`，`src/files/infrastructure/url/**`，`src/utils/serializer.interceptor.ts`，`src/main.ts`。
- 兼容性：URL 的查询参数可以变，路径字段仍叫 `path`。
- 风险：预签名 URL 在响应里从 Promise 变成字符串的时机变化。e2e 若断言 URL，要更新。
- 验收：`pnpm run build`；检索 `ResolvePromisesInterceptor` 无引用；文件相关 e2e 或一条新的单元测试覆盖 local 与 presigned 两种 path。
- 前置：T6.1。人工确认：否。

### T6.3 异常过滤器

- 目标：全局过滤器。`HttpException` 保持 `{ status, errors }`。未知错误记日志并返回无堆栈的 500。畸形 JSON 查询返回 422。
- 文件：`src/common/filters/**`，`src/main.ts`，`src/users/dto/query-user.dto.ts`。
- 兼容性：500 的响应体从框架默认改为统一形状。422 保持。
- 风险：过滤器包掉了 422 的 `errors` 结构。用现有校验 e2e 卡住。
- 验收：校验失败 e2e；一条故意抛错的测试断言响应无 stack。
- 人工确认：否。

### T6.4 分页

- 目标：`infinityPagination` 改为多取一行判断 `hasNextPage`，响应数据去掉多取的那一行。
- 文件：`src/utils/infinity-pagination.ts`，用户列表仓储的 `take`。
- 兼容性：最后一页 `hasNextPage` 从 true 变为 false。这是缺陷修复。
- 风险：客户端依赖错误的 true。发布说明写一句。
- 验收：恰好满页与未满页的单元测试。
- 人工确认：否。

### T6.5 上传

- 目标：local / s3 用文件头判断 jpeg/png/gif，不单靠扩展名。presigned 的 `PutObject` 带 `ContentType` 与 `ContentLength` 条件。孤儿 `file` 记录由 Worker 定时任务清理，只删超过 24 小时且没有被 `user.photoId` 引用的行。
- 文件：`src/files/**`，`src/workers/**`。
- 兼容性：上传非法内容从 201 变为 422。清理任务不碰有引用的文件。
- 风险：定时任务误删。先做单元测试，dry-run 日志打印将删除的 id。
- 验收：伪造扩展名的用例 422；孤儿清理用例不删被引用行。
- 人工确认：否。首次启用定时删除要在 PR 里写明条件。

### T6.6 生产默认值

- 目标：`NODE_ENV=production` 不挂 Swagger，并因此可以打开 Helmet CSP。生产拒绝 CORS `*`。`env-example` 里 `AUTH_UNIFORM_ERRORS=true`。
- 文件：`src/main.ts`，`src/config/app.config.ts`，`env-example-relational`。
- 兼容性：生产行为收紧。开发默认仍开 Swagger。
- 风险：e2e 在 production 模式下跑。测试环境保持 `NODE_ENV=test`，不走生产开关。
- 验收：`NODE_ENV=production` 的启动测试断言没有 `/docs` 路由，且 CORS `*` 导致启动失败。
- 人工确认：否。

### T6.7 生成器与 Agent 说明

- 目标：Hygen 只生成 Prisma 模块，不再生成 TypeORM / Mongoose。更新 `.claude/skills/generate/SKILL.md` 和 `docs/cli.md`。
- 文件：`.hygen/**`，`.claude/skills/generate/SKILL.md`，`docs/cli.md`。
- 兼容性：生成器的对外命令名可以保留 `generate:resource:relational`，文档说明它现在只产出 Prisma。
- 风险：模板再次写出双库块。验收检索生成结果没有 `database-block`。
- 验收：生成一次、编译通过、删除生成物。
- 前置：T5.5。人工确认：否。

## 阶段 7：工程化验收

前置：阶段 6 tag。

### T7.1 Docker 最终形态

- 目标：实施设计第 10 节。多阶段，api / worker / migrator，非 root，生产依赖，迁移不是 API 的 CMD，seed 只在 profile `seed`。
- 文件：`Dockerfile`，`docker-compose.yaml`，删除已无引用的 `relational.*.Dockerfile` 若职责并入同一 Dockerfile。
- 兼容性：开发命令会变，写进 `docs/installing-and-running.md`（T7.3）。
- 风险：migrator 以 root 运行。三个 target 都要 `USER node`。
- 验收：`docker compose up` 后 live/ready 成功，Worker 消费一条邮件，容器内 `id` 不是 0。
- 人工确认：否。

### T7.2 CI 最终形态

- 目标：实施设计第 10 节的 job 列表。缓存按 pnpm lock。
- 文件：`.github/workflows/**`。
- 兼容性：无。
- 风险：e2e job 连到默认服务。检查 workflow 里的环境变量没有生产主机。
- 验收：PR 上每个 job 的命令与第 10 节一致，并在本地能跑静态检查和 e2e。
- 人工确认：否。

### T7.3 文档与规则

- 目标：`docs/*.md`、`env-example-relational`、`CLAUDE.md`、`AGENTS.md`、`.claude/skills/generate/SKILL.md` 与最终架构一致。删除或改写仍在教双库、TypeORM、npm 的段落。
- 文件：上述文档。
- 兼容性：无。
- 风险：Agent 规则仍要求用 npm。这会让后续代理把锁文件加回来。
- 验收：检索这些文件，`mongoose`、`typeorm`、`npm ci` 只出现在历史说明或明确的“不要使用”里。
- 人工确认：否。

### T7.4 空环境演练

- 目标：在干净目录按文档从安装走到测试：frozen install、migrate deploy、seed（显式）、API、Worker、单元测试、e2e、消费一条邮件。
- 文件：无，除了演练发现的缺陷。
- 兼容性：无。
- 风险：演练用了本机残留的 `node_modules`。必须删掉后重装。
- 验收：命令和结果写进 PR。失败则开任务，不把本任务标成完成。
- 前置：T7.1、T7.2、T7.3。人工确认：否。

### T7.5 验收清单

- 目标：对照改造计划第 11 节逐项给出证据（命令、测试名或配置位置）。缺项保持未勾选。
- 文件：`docs/modernization/ACCEPTANCE.md`（此文件到阶段 7 才创建）。
- 兼容性：无。
- 风险：把“代码里有这个类”当成“测试通过”。证据必须是命令输出或测试名。
- 验收：清单本身。
- 前置：T7.4。人工确认：是，确认后才算改造结束。

## 状态

| 任务 | 状态 |
| --- | --- |
| 阶段 0 文档 | 已完成 |
| T1.1–T1.5 | 已完成。`pnpm install --frozen-lockfile`、`pnpm run build`、`pnpm run lint`、`pnpm exec jest --passWithNoTests` 通过。本机没有 Docker，关系型 e2e 未跑 |
| T1.6 | 跳过。可选补丁要靠 e2e 卡住行为变化，当前环境没有 Docker |
| T2a.1 | 已完成。`pnpm run build` 与 `pnpm run lint` 通过。本机没有 Docker，关系型 e2e 和生成器套件未跑。`src`、`test`、`package.json`、`.github` 中已无 mongoose |
| T2b.1 至 T7.5 | 未开始 |
