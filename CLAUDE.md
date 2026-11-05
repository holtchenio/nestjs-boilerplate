# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

这是一个 NestJS 样板项目，在单一代码库中同时支持关系型（TypeORM/PostgreSQL）和文档型（Mongoose/MongoDB）持久化。

@AGENTS.md

## 常用命令

使用 `npm`（`package-lock.json` 已提交；忽略未跟踪的 `pnpm-lock.yaml`）。Node 版本固定在 `.nvmrc`（24.x）。

```bash
npm run start:dev        # 开发服务器（监听模式，默认端口 3001）
npm run build            # 编译到 dist/
npm run lint             # 对 {src,apps,libs,test}/**/*.ts 执行 eslint
npm run format           # 对 src/ 和 test/ 执行 prettier --write

pnpm test                # 单元测试（vitest，include 为 src/**/*.spec.ts）
npm run test -- <path>   # 运行单个测试文件，例如 npm run test -- users/users.service.spec.ts
npm run test:cov         # 带覆盖率的单元测试
npm run test:e2e         # e2e 测试（需要运行中的数据库）
```

### 数据库（关系型 / TypeORM）

```bash
npm run migration:generate -- src/database/migrations/<Name>  # 根据实体差异生成迁移
npm run migration:run                                        # 执行迁移
npm run migration:revert                                     # 回滚迁移
npm run schema:drop                                          # 删除所有表
npm run seed:run:relational                                  # 运行关系型种子数据
npm run seed:create:relational -- --name <Entity>            # 生成种子文件骨架
```

### 数据库（文档型 / Mongoose）

```bash
npm run seed:run:document
npm run seed:create:document -- --name <Entity>
```

### 代码生成

项目通过 Hygen 生成器保持两种数据库实现、DTO、模块和迁移的同步。新增实体/schema 或属性时，请使用 `generate` skill（自动从 `.claude/skills/generate/SKILL.md` 加载）——不要手写实体/schema 文件。相关命令为 `npm run generate:resource:*` 和 `npm run add:property:to-*`。

## 架构

应用遵循**六边形架构（端口与适配器）**：业务逻辑位于 `domain` 层，不依赖数据库或其他基础设施；所有基础设施关注点都封装在端口接口之后，可通过适配器替换。详细文档位于 `docs/`（从 `docs/architecture.md` 开始）。

### 双数据库机制

使用哪种数据库由 `DATABASE_TYPE` 环境变量在运行时决定：当 `DATABASE_TYPE` 为 `mongodb` 时，`databaseConfig` 将 `isDocumentDatabase` 置为 `true`，否则为 `false`。每个需要持久化的模块都通过形如 `// <database-block>` 的注释区域，根据该标志切换适配器，例如在 `src/app.module.ts` 和各个 `*.module.ts` 中：

```ts
const infrastructurePersistenceModule = (databaseConfig() as DatabaseConfig)
  .isDocumentDatabase
  ? DocumentUserPersistenceModule
  : RelationalUserPersistenceModule;
```

这些 `// <database-block>` 标记是 Hygen 生成器重写的位置——手动编辑时请保持它们完整。

### 单个领域模块的结构

领域模块（如 `src/users`、`src/session`、`src/files`、`src/roles`、`src/statuses`）共享以下结构：

```
domain/                          # 与框架/数据库无关的实体
dto/                             # 使用 class-validator + Swagger 的请求 DTO
infrastructure/persistence/
  <name>.repository.ts           # 端口（抽象类 / 接口）
  relational/                    # TypeORM 适配器：entities/、mappers/、repositories/、relational-persistence.module.ts
  document/                      # Mongoose 适配器：entities/*.schema.ts、mappers/、repositories/、document-persistence.module.ts
<name>.module.ts                 # 装配 controller + service 及选中的持久化模块
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

将 `env-example-relational` 或 `env-example-document` 复制为 `.env`（具体运行/初始化步骤和 Docker 服务见 `docs/installing-and-running.md`）。关键值：`DATABASE_TYPE` 选择持久化适配器；`FILE_DRIVER` 选择上传存储；邮件通过 Maildev 发送（`MAIL_HOST=maildev`，UI 地址 `http://localhost:1080`）。
