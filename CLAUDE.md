# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

这是一个 NestJS 样板项目。业务库只有 PostgreSQL，ORM 只有 Prisma。Redis 负责缓存、限流和 BullMQ。API 与 Worker 是两个入口。

@AGENTS.md

## 常用命令

只用 pnpm。锁文件是 `pnpm-lock.yaml`。不要再引入 npm 锁文件。Node 版本固定在 `.nvmrc`（24.x）。

```bash
pnpm run start:dev        # API，监听模式，默认端口 3001
pnpm run start:worker:dev # Worker
pnpm run build            # 编译到 dist/
pnpm run lint
pnpm run typecheck
pnpm test                 # 单元测试（vitest，include 为 src/**/*.spec.ts）
pnpm run test:e2e         # e2e，需要已启动的数据库、Redis、API 和 Worker
```

### 数据库（Prisma / PostgreSQL）

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma migrate dev --name <Change>
pnpm exec prisma db seed
pnpm run seed:create:relational -- --name <Entity>
```

不要使用 `prisma migrate reset` 清理仍需保留的库。

### 代码生成

新增实体或属性时使用 `generate` skill。命令是 `pnpm run generate:resource:relational` 和 `pnpm run add:property:to-relational`。它们生成 Prisma 模块，不生成第二种数据库。

## 架构

应用遵循**六边形架构（端口与适配器）**：业务逻辑位于 `domain` 层，不依赖数据库或其他基础设施；所有基础设施关注点都封装在端口接口之后，可通过适配器替换。详细文档位于 `docs/`（从 `docs/architecture.md` 开始）。

### 持久化

每个需要持久化的模块只绑定 Prisma 适配器：

```ts
const infrastructurePersistenceModule = PrismaUserPersistenceModule;
```

### 单个领域模块的结构

领域模块（如 `src/users`、`src/session`、`src/files`、`src/roles`、`src/statuses`）共享以下结构：

```
domain/                          # 与框架/数据库无关的实体
dto/                             # 使用 class-validator + Swagger 的请求 DTO
presenters/                      # 响应形状（用户模块）
infrastructure/persistence/
  <name>.repository.ts           # 端口（抽象类）
  prisma/                        # Prisma 适配器
<name>.module.ts
<name>.controller.ts
<name>.service.ts
```

模式规则：

- 端口（`<name>.repository.ts`）是 service 注入的抽象类；每个适配器模块通过 `{ provide: Port, useClass: Adapter }` 绑定。
- `mappers/` 负责持久化实体与领域实体之间的双向转换。
- 仓储应暴露职责单一的方法（`findByEmail`、`findByIds`），而不是通用的 `find(condition)`。

### 配置

配置通过 `@nestjs/config` 的 `registerAs` 命名空间加载（`databaseConfig`、`authConfig`、`appConfig`、`mailConfig`、`fileConfig` 以及各社交登录提供方的配置）。每个命名空间文件定义一个带 `class-validator` 装饰器的 `EnvironmentVariablesValidator`，并调用 `validateConfig()`（`src/utils/validate-config.ts`），使非法的环境变量值快速失败。合并后的类型为 `src/config/config.type.ts` 中的 `AllConfigType`；读取值使用 `configService.getOrThrow('namespace.key', { infer: true })`。

### 启动相关（`src/main.ts`）

- 全局前缀来自 `APP_API_PREFIX`（默认 `api`），启用 URI 版本控制。
- 全局 `ValidationPipe`（使用 `validationOptions`）、`HttpErrorFilter` 和 `ClassSerializerInterceptor`（序列化时遵循 presenter 上的 `@Exclude`/`@Expose`）。生产环境不挂 Swagger。
- Swagger UI 挂载在 `/docs`，支持 bearer 认证。
- 通过 `nestjs-i18n` 实现国际化；语言由 `x-custom-lang` 请求头决定，翻译文件位于 `src/i18n/*`（在 `nest-cli.json` 中作为 assets 打包）。

### 认证

基于 token 的认证，使用不同的短期/长期密钥（见 `env-example-*`）：access（`AUTH_JWT_*`，15m）、refresh（`AUTH_REFRESH_*`，30d）、忘记密码（30m）、邮箱确认（1d）。策略位于 `src/auth/strategies/`（`jwt`、`jwt-refresh`、`anonymous`）；角色通过 `@Roles()` + `RolesGuard`（`src/roles/`）强制执行。社交登录按提供方分别实现在 `src/auth-apple`、`src/auth-facebook`、`src/auth-google`。

### 文件上传

`src/files` 通过 `FILE_DRIVER` 选择三种驱动：`local`、`s3`、`s3-presigned`，每种都是独立的 `infrastructure/uploader/*` 适配器模块。

## 环境

将 `env-example-relational` 复制为 `.env`。宿主机开发时把 `DATABASE_HOST` 和 `MAIL_HOST` 改成 `localhost`，`REDIS_URL` 改成 `redis://localhost:6379`。容器内保持 `postgres`、`maildev` 和 `redis://redis:6379`。不要把这些地址指到生产库。步骤见 `docs/installing-and-running.md`。
