# 实施设计

日期：2026-11-04。阶段 0 交付，不修改业务代码、依赖、数据库或锁文件。

配套文档：

- 表结构和迁移步骤：[MIGRATION_PLAN.md](MIGRATION_PLAN.md)
- 会话、刷新令牌、Cookie：[AUTH_DESIGN.md](AUTH_DESIGN.md)
- 任务卡：[TASK_BREAKDOWN.md](TASK_BREAKDOWN.md)

改造基线是仓库外的 `NestJS_Boilerplate_Modernization_Plan.md`。技术偏好已经确定：PostgreSQL、Prisma、pnpm、Redis、BullMQ、Node 原生 ESM。本文件把这些偏好落到当前仓库上，并记下和 `docs/audit/` 的冲突。

## 1. 与审计结论的冲突

`docs/audit/UPGRADE_PLAN.md`（2026-11-04）建议维持 TypeORM 0.3、npm、CommonJS，并且不引入 Redis。那份审计的理由仍然成立：现有查询简单、没有单元测试、e2e 是唯一安全网。

本次不采用那份审计的技术栈结论。改造文档把 Prisma、pnpm、ESM、Redis、BullMQ 定为目标，阶段 0 按这个目标做设计。审计里仍然有效、并且被本设计吸收的部分：

- 依赖补丁清单（`docs/audit/DEPENDENCY_UPGRADE_PLAN.md` 第一批）。可选任务 T1.6，不和换包管理器绑在同一次提交里。
- 安全问题 S1 到 S10 的修复归属，见第 9 节。
- 领域对象与 Swagger、`class-transformer`、S3 签名脱钩。放在阶段 6，不和换 ORM 同时做。

`docs/audit/` 与根目录未跟踪的 `pnpm-lock.yaml` 都保持原样。阶段 0 不删除、不提交它们。

## 2. 已确认的决策

| 项 | 决定 |
| --- | --- |
| 存量数据 | 没有需要保留的库。主路径是空库重建。接管已有库只写在迁移方案里备用 |
| 工程布局 | pnpm 单包。入口 `src/main.ts`（API）和 `src/worker.ts`（Worker），共享 `src/`。不做 workspace |
| Web 刷新令牌 | `HttpOnly` Cookie + CSRF。移动端和桌面端继续 Bearer，响应体返回 `refreshToken` |
| 事务 | 仓储方法接收可选的事务客户端。不引入 `@nestjs-cls/transactional`，除非以后调用链深过两层并单独批准 |
| 测试框架（阶段 5） | Vitest 4 + `unplugin-swc`。依据见第 8 节。在那之前保持现有 Jest |
| pnpm | 10.34.9。不在本阶段改用 11 或 12 |

## 3. 现状基线

核对时间：2026-11-04。分支 `docs/chinese-agent-guidance`，HEAD `5894b50e33f8cc7f48a8cbb350d33afa2462c891`。工作区未跟踪文件只有 `docs/audit/` 和 `pnpm-lock.yaml`（lockfileVersion 9.0，`autoInstallPeers: true`）。那份锁文件不沿用，阶段 1 按 `.npmrc` 策略重新生成。

| 项 | 事实 |
| --- | --- |
| 运行时 | `.nvmrc` 为 `24.14.1`。本机 Node `24.22.0`，pnpm `10.34.9`。`package.json` 的 `engines` 仍是 `node >=16`、`npm >=8` |
| 框架 | NestJS `11.1.18`，TypeScript `5.9.3`，`module: commonjs`。`strict` 未完全打开：`strictPropertyInitialization`、`strictBindCallApply`、`forceConsistentCasingInFileNames`、`noFallthroughCasesInSwitch` 为 false |
| 数据 | PostgreSQL + TypeORM `0.3.28`，同时保留 Mongoose `9.4.1`。5 张表，1 条迁移 |
| 双库切换 | 10 个 `src` 文件含 `// <database-block>`：`app.module.ts`、三个业务模块、三个 uploader 模块、`user` / `role` / `status` 领域文件 |
| 队列 / Redis | 无。`WORKER_HOST` 和 compose 里被注释的 redis 没有消费者 |
| 邮件 | 仅 `AuthService` 三处调用，请求内 `await`。文案来自 `I18nContext.current()` |
| 测试 | `src/**/*.spec.ts` 为 0。e2e：`test/user/auth.e2e-spec.ts`、`test/admin/auth.e2e-spec.ts`、`test/admin/users.e2e-spec.ts`。生成器 e2e 另算。没有 logout 用例 |
| 容器 | `Dockerfile` 单阶段、root、`npm`、启动脚本会 seed |

数据层和认证的细节不在这里重复，分别见迁移方案第 3 节和认证设计第 1 节。

## 4. 目标结构

不大规模搬动现有模块。新增的是基础设施入口，删除的是文档库和 TypeORM 适配器目录。

```text
src/
  main.ts                      API 入口
  worker.ts                    Worker 入口，不监听 HTTP
  app.module.ts                API 装配
  worker.module.ts             Worker 装配：配置、Prisma、Redis、队列消费者
  config/                      继续 registerAs + class-validator
  common/
  database/
    prisma.module.ts
    prisma.service.ts
  cache/
    redis.module.ts
    redis.service.ts
  queue/
    queue.module.ts
    queue.constants.ts
  health/
  auth/  users/  session/  files/  mail/  mailer/
  workers/
    mail/
  generated/prisma/            prisma generate 输出，不提交
prisma/
  schema.prisma
  migrations/
  seed.ts
prisma.config.ts
```

各业务模块的 `infrastructure/persistence/relational` 与 `document` 在阶段 2 改为 `infrastructure/persistence/prisma`。端口文件留在 `infrastructure/persistence/*.repository.ts`。

依赖方向保持现在的样子：`AuthModule` → `UsersModule`、`SessionModule`、`MailModule`；社交登录模块 → `AuthModule`。模块只导出 Service，不导出持久化模块。这一条放在阶段 6 和阶段 2 的仓储替换一起收口，避免阶段 2 只换实现却继续把 `Repository` 导出到模块外。

仓储保留 `UserRepository`、`SessionRepository`、`FileRepository` 三个抽象类，供单元测试替换。roles、statuses 只留枚举和种子。Prisma 生成类型不得出现在 DTO 和 HTTP 响应里。

## 5. 版本矩阵

注册表核对日期：2026-11-04。下表是本设计选定的版本，不是当天 `latest` 标签。

| 用途 | 选定 | 不选 | 依据 |
| --- | --- | --- | --- |
| Node | 24.14.1（`.nvmrc` 已有） | 不把 Node 26 和本次绑在一起 | Nest 12 的 engines 接受 `>=24`；`nestjs-pino@5.3.1` 要求 `>=22.12` |
| pnpm | 10.34.9 | 12.16.1（`latest`）、11.x | 本机已安装；未跟踪锁文件是 lockfileVersion 9。11/12 的锁格式和构建脚本配置键没有在本次验证 |
| Nest 运行时 | 先保持 11.1.18，T1.6 可选升到 11.2.8 | 12.3.3 不进本次改造 | 换 ORM、队列、ESM 已经足够；框架主版本另案 |
| Prisma | `prisma`、`@prisma/client`、`@prisma/adapter-pg` 都是 7.10.1 | CLI `latest` = `8.0.0-rc.30` | 7.10.1 的 engines 为 `node ^20.19 \|\| ^22.12 \|\| >=24`。生成 ESM 客户端已在第 8 节验证 |
| BullMQ | `bullmq@6.6.0`，`@nestjs/bullmq@11.0.5` | `@nestjs/bullmq@12`（那是集成包的主版本号，不是 Nest 12 专属，但 11.0.5 已声明兼容 Nest 10/11 和 bullmq 6） | 第 8 节：两个包都能在 ESM 下被 import |
| Redis 客户端 | `ioredis@5.11.1` | `ioredis@6.0.0` | BullMQ 6 只把 `ioredis >=5` 列为 peer，不放进 dependencies。本次验证没有安装 ioredis 6，因此不选它。应用必须自己声明 5.11.1 |
| 日志 | `nestjs-pino@5.3.1`、`pino@10.4.0`、`pino-http@11.0.0` | | peer 接受 Nest 11.0.8 以上。当前 11.1.18 满足。T1.6 升到 11.2.8 之后仍然满足 |
| 健康检查 | `@nestjs/terminus@12.1.0` | | peer 为 Nest `^11 \|\| ^12`，Node engines 含 `>=24`。包的主版本号是 12，不要求把 Nest 升到 12 |
| 限流 | `@nestjs/throttler@6.7.1` | 不先加 `@nest-lab/throttler-storage-redis` | 存储用 `src/cache` 里的小实现。第三方存储包的接口未核对 |
| Cookie | `cookie-parser@1.4.7` | | 仅阶段 4 |
| TypeScript | 5.9.3，阶段 6 起分项打开 strict | 6 / 7 | 与现有 Nest 11 基线一致 |
| 测试（阶段 5 之后） | `vitest@4.0.18`、`unplugin-swc@1.5.9` | 继续用 `ts-jest` 跑 ESM | 第 8 节 |

阶段 1 到阶段 4 结束前，应用仍是 CommonJS，测试仍是现有 Jest 30 + ts-jest。上表里的 Vitest 只在阶段 5 替换。

## 6. pnpm

`.npmrc`：

```ini
strict-peer-dependencies=true
auto-install-peers=false
```

`package.json`：

```json
{
  "packageManager": "pnpm@10.34.9",
  "engines": { "node": ">=20.19.0" }
}
```

pnpm 10 默认不运行依赖的构建脚本。`pnpm.onlyBuiltDependencies` 放行 `@swc/core`、`prisma`、`@prisma/engines`。未放行就安装失败，不允许改成全局 `ignore-scripts=false` 或放宽 peer 来“先装上”。

本地、CI、Docker 都通过 corepack 使用 `packageManager` 里的版本。安装验收命令是 `pnpm install --frozen-lockfile`。删除 `package-lock.json` 之前，build、lint、关系型 e2e 必须先绿。

scripts、husky、`startup.*.sh`、Dockerfile、GitHub Actions 里的 `npm` / `npx` 改成 pnpm。`release-it` 的 `npm.publish: false` 保持，不把模板发布到 npm。

## 7. Redis、队列、日志、健康检查

### 7.1 Redis 的边界

Redis 用于：限流计数、登录失败计数、Access Token 剩余寿命内的撤销缓存、BullMQ broker。

不用于：用户、会话、刷新令牌、文件记录的权威存储。会话是否有效以 PostgreSQL 为准。Redis 故障时，`JwtStrategy` 回退读库，不放行。见认证设计第 5 节。

连接放在 `RedisModule`。`onModuleDestroy` 执行 `quit`。配置项 `REDIS_URL`，替换没有消费者的 `WORKER_HOST`。

### 7.2 队列

API 进程只注册 producer。Worker 进程只注册 consumer。两边共享队列名和载荷类型。

首批只有 `mail` 队列。API 在注册、忘记密码、更改邮箱这三处入队，不再 `await` SMTP。

载荷：

```ts
type MailJob =
  | { kind: 'confirm-email'; userId: number; lang: string }
  | { kind: 'forgot-password'; userId: number; lang: string }
  | { kind: 'confirm-new-email'; userId: number; lang: string; newEmail: string };
```

不放入 JWT、密码、hash、邮箱以外的个人字段。`newEmail` 是发信所必需的目标地址，例外只此一项。确认链接和重置链接的 JWT 由 Worker 发送前签发，重置密钥仍拼接当前密码哈希，改密后链接失效的语义不变。

`lang` 来自请求的 `x-custom-lang`（或 `APP_HEADER_LANGUAGE`）。Worker 没有 `I18nContext.current()`，必须用 `I18nService` 按 `lang` 取文案。这是阶段 3 的必改点，不是优化。

| 参数 | 值 |
| --- | --- |
| 重试 | 5 次，指数退避，起始 5 秒 |
| 幂等 | `jobId` 为 `mail.{kind}.{userId}.{时间桶}`。同一用户同一类邮件在 60 秒内重复提交不产生第二封。BullMQ 6 不允许自定义 id 含冒号 |
| 并发 | Worker `concurrency: 5` |
| 单次超时 | nodemailer `connectionTimeout` 与 `socketTimeout` 各 10 秒。BullMQ 的 `lockDuration` 设为 30 秒，避免锁先于 SMTP 过期 |
| 失败 | pino `error`，带 `jobId` 和 `kind`，不带载荷里的 `newEmail` |
| 保留 | 完成的 job 保留 24 小时或最多 1000 条；失败的保留 7 天 |
| 重复执行 | 允许。邮件重复发送优于静默丢失。幂等窗口只挡短时间双击 |
| 人工补偿 | 失败 job 留在队列里供 `bullmq` 的重试；本轮不做管理界面 |

不引入 Outbox。现有三封邮件丢了可以让用户再次点击。若以后出现“数据库已提交但必须恰好投递一次”的写操作（例如扣减、外部支付），再为那条流程加 Outbox，不回溯到邮件。

文件处理、导入导出不在首批。阶段 3 不新增这类队列。

### 7.3 日志

`nestjs-pino` 输出 JSON。请求 id 取 `x-request-id`，没有则生成。脱敏字段：`req.headers.authorization`、`req.headers.cookie`、`res.headers["set-cookie"]`、`password`、`oldPassword`、`refreshToken`、`token`、`hash`。

Worker 日志绑定 `jobId`、`queue`、`kind`。禁止新增 `console.*`。`auth-facebook.service.ts` 里现有的 `console.error` 在阶段 6 换成注入的 logger。

### 7.4 健康检查

两个路由都排除在 URI 版本之外，使用 `VERSION_NEUTRAL`，也不要被全局前缀挡住（与现在 `GET /` 一样放进 `setGlobalPrefix` 的 exclude，或挂在前缀内但固定为 `/api/health/*`）。选定挂在前缀内：

- `GET /api/health/live`：进程存活，不访问依赖
- `GET /api/health/ready`：Prisma `SELECT 1` 与 Redis `PING`

响应只包含 `status` 和检查名。不返回连接串、主机名配置或版本以外的环境。`GET /` 的应用信息保留，不把它当作探针。

## 8. ESM 与兼容性验证

验证目录是仓库外的 `/tmp/nestjs-modernization-spike`（`package.json` 为 `"type": "module"`，Node `24.22.0`）。结论写入之后该目录已删除。没有启动 PostgreSQL 或 Redis，因此没有做真实查询和真实入队。

| 检查 | 结果 |
| --- | --- |
| `prisma@7.10.1 generate`，`moduleFormat = "esm"`，并由 `prisma.config.ts` 提供 URL | 成功。输出是带 `.js` 后缀和 `import.meta.url` 的 TypeScript，没有同时发射 `.js` |
| 用 `module: nodenext` 编译该客户端后再 `import { PrismaClient }` | 成功。`PrismaPg` 也可 import。未连接数据库 |
| 直接用 Node 执行未编译的 `client.ts` | 失败。相对导入 `./enums.js` 在只存在 `.ts` 时无法解析。应用必须把生成目录编进构建，不能指望 Node 直接跑生成物 |
| `import { Queue, Worker } from 'bullmq'`，先 5.81.5 后 6.6.0 | 两者都成功 |
| `import { BullModule } from '@nestjs/bullmq'`（11.0.5，与 bullmq 6.6.0 一起安装） | 成功。peer 为 Nest `^10 \|\| ^11`、bullmq `^3 \|\| ^4 \|\| ^5 \|\| ^6` |
| 循环依赖的两个 `@Injectable()` 类，`emitDecoratorMetadata`，`tsc` 之后 `node dist/a.js` | 失败：`ReferenceError: Cannot access 'A' before initialization`（`__metadata("design:paramtypes", [A])`） |
| Jest `30.3.0` + `@swc/jest@0.2.39`，`node --experimental-vm-modules` | 1 个 ESM 用例通过，并打印 VM Modules 的 ExperimentalWarning |
| Vitest `4.0.18` + `unplugin-swc@1.5.9`，`globals: true` | 同一个用例通过，无实验性标志 |

未验证，阶段 5 的 T5.0 / T5.5 仍要做：Hygen（`.hygen.js` 使用 `module.exports` 和 `__dirname`）、`ts-node` 脚本、完整 Nest 应用启动、Prisma 对真实库的 `migrate deploy`、BullMQ 对真实 Redis 的消费。这些不在本次 spike 的范围内，不能写成已经通过。

### 8.1 由此确定的 ESM 做法

- 阶段 5 才设置 `"type": "module"`。阶段 2 的 Prisma generator 使用 `moduleFormat = "cjs"`，阶段 5 改为 `esm` 并重新生成。
- `tsconfig` 改为 `module` / `moduleResolution`: `nodenext`，相对导入写 `.js` 后缀。
- `__dirname` 改为 `import.meta.dirname`（Node 20.11+ / 24 已有）。现用点是 `src/app.module.ts` 的 i18n 路径，以及将被删除的 TypeORM `data-source.ts`。
- 生成的 Prisma 客户端纳入 `nest build` 的编译范围，不把 `generated/**` 排除掉。
- 循环注入：禁止新的跨文件构造函数循环。现有模块没有 `forwardRef`。若 ESM 化之后某个装饰器元数据仍触发 TDZ，先拆循环，不用 `await import()` 绕过。
- 脚本运行器从 `ts-node` 换成 `tsx`。`env-cmd` 保留到阶段 5 再看它在 ESM 下的入口；不能用就改成 `node --env-file`。
- 测试换成 Vitest。Jest 只作为 T5.4 的退路：若 Nest 的 e2e 启动方式迁不动，可以留在 Jest + `@swc/jest`，但必须接受 `--experimental-vm-modules`。默认不走这条退路。
- `bcryptjs` 和 `ms` 的默认导入在 ESM 下要逐个编译验证。本次 spike 没有安装这两个包，T5.3 负责。

## 9. 安全项归属

来自 `docs/audit/SECURITY_AUDIT.md`，按阶段消化，避免在阶段 2 顺手改 API。

| 编号 | 内容 | 阶段 |
| --- | --- | --- |
| S1 | handlebars、nodemailer、multer、platform-express、config、typeorm 补丁 | T1.6 可选。换 ORM 之后 typeorm 告警自然消失；multer / nodemailer / handlebars 仍要补 |
| S2 | 未确认邮箱可以登录 | 不改。e2e 已固定该行为 |
| S3 | 认证无限流 | 阶段 4 |
| S4 | 角色来自 JWT | 不改。刷新时重读角色的行为保持 |
| S5 | 生产 Swagger、CORS `*` | 阶段 6。Cookie 模式在阶段 4 就拒绝 `*` |
| S6 | 本地下载无认证、扩展名不等于内容、预签名先落库 | 阶段 6。签名移出领域对象 |
| S7 | Facebook 把“有 email”当成已验证 | 不在本轮改绑定语义。只在阶段 6 去掉 `console.error` |
| S8 | 排序无白名单、畸形 JSON 查询 | 排序白名单在阶段 2。JSON 422 在阶段 6 的异常过滤器 |
| S9 | 唯一约束变成 500、重置密码无事务 | 阶段 2 |
| S10 | 镜像 root、启动即 seed | 阶段 7 收口；阶段 1 只把包管理器换成 pnpm，不把单阶段镜像误当成最终形态 |

## 10. Docker 与 CI 的目标形态

阶段 1 只把现有 Dockerfile 和 workflow 里的 npm 换成 pnpm，并仍能跑关系型 e2e。最终形态在阶段 7：

- 一个多阶段 Dockerfile，target 为 `api`、`worker`、`migrator`。构建阶段 corepack 启用 `packageManager` 指定的 pnpm，`pnpm install --frozen-lockfile`。运行阶段只含生产依赖，用户 `node`，入口分别是 `node dist/main.js`、`node dist/worker.js`、`pnpm exec prisma migrate deploy`。
- compose：`postgres`、`redis`、`maildev`、`api`、`worker`。迁移是一次性服务，不是 API 的启动命令。seed 放在 profile `seed`，默认不执行。
- 删除 document 的 compose、Dockerfile 和启动脚本（阶段 2a）。
- CI：静态检查（frozen install、format、lint、typecheck、`prisma validate`）、单元测试、`prisma migrate diff` 漂移检查、e2e（postgres + redis + maildev）、Docker 构建、`pnpm audit --prod`。不连接生产库。

## 11. 阶段顺序

```text
阶段 0  设计（本次）
阶段 1  pnpm，可选的 Nest 11 补丁
阶段 2a 删除 Mongo
阶段 2b Prisma 替换 TypeORM
阶段 3  Redis、BullMQ、Worker、pino、健康检查
阶段 4  认证
阶段 5  ESM
阶段 6  领域解耦与其余安全项
阶段 7  Docker、CI、文档、空环境验收
```

相对改造文档的两处调整：

1. 删除 Mongo 单独成为 2a，并且在 Prisma schema 之前。否则要为即将删除的库写适配器，或在同一提交里既删文件又换 ORM。
2. pino 和健康检查从“阶段 6 / 7”提前到阶段 3。Worker 的失败日志和 readiness 都依赖它们。认证仍放在队列之后，因为撤销缓存和限流存储都要 Redis。

ESM 放在认证之后，是为了让阶段 2 到 4 的排错不被 `.js` 后缀和装饰器 TDZ 干扰。代价是 Prisma 客户端要生成两次（先 cjs，后 esm）。这个代价写进阶段 5 的任务，不提前。

每个阶段一次提交，打 tag `modernization/stage-N`。上一阶段的验收命令不绿，不开始下一阶段。高风险任务（删除锁文件、删除 Mongo、删除 TypeORM、认证迁移、ESM 开关）在任务卡上标了人工确认。

## 12. 风险

| 风险 | 表现 | 处理 |
| --- | --- | --- |
| 序列化分组在阶段 6 搬迁时漏掉 `@Expose` | 密码出现在响应里，或邮箱在不该出现的接口出现 | e2e 断言响应体没有 `password`；`me` 与管理员列表分别断言 `email` |
| 邮件改异步 | 现有 e2e 立刻向 maildev 要信会空 | 轮询 maildev，超时失败；测试进程要启动 Worker |
| Cookie 与 `CORS *` | 浏览器拒绝带凭证的响应 | 配置校验直接拒绝该组合 |
| ESM 装饰器元数据 | 循环注入在启动时 `ReferenceError` | 第 8 节已复现。禁止用动态 import 掩盖 |
| pnpm 严格 peer | 安装失败，暴露原先 npm 树里的幽灵依赖 | 补声明或换版本，不把 `strict-peer-dependencies` 设成 false |
| 构建脚本被 pnpm 10 跳过 | `prisma generate` 或 `@swc/core` 不可用 | 只用 `onlyBuiltDependencies` 白名单 |
| 阶段 2 夹带认证语义 | 刷新或登出行为在换 ORM 时改变 | 阶段 2 保留 `session.hash` 和现有 `AuthService`。认证表结构留到阶段 4 |
| `sessionId` 在阶段 4 变为 uuid | 把 sessionId 当数字的客户端会坏 | 发布说明写明；没有存量令牌。Bearer 响应字段名不变 |
| spike 未覆盖真实队列和 Hygen | 阶段 3 / 5 才发现工具链不通 | T3.3、T5.0 把“连上 Redis 的消费”和 Hygen 列为门禁，不沿用本次的 import 成功当作运行成功 |

## 13. 阶段 0 没有做的事

- 没有改 `src/`、`test/`、Docker、CI、`package.json`、两份锁文件。
- 没有执行迁移、seed、`schema:drop`。
- 没有创建分支或提交。
- 兼容性 spike 没有连接数据库和 Redis。对应的运行验证留在阶段 3 和阶段 5。
