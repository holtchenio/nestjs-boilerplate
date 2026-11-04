# 数据库迁移方案

日期：2026-11-04。配套文档：[IMPLEMENTATION_DESIGN.md](IMPLEMENTATION_DESIGN.md)、[AUTH_DESIGN.md](AUTH_DESIGN.md)、[TASK_BREAKDOWN.md](TASK_BREAKDOWN.md)。

本文件只描述方案。阶段 0 不改 schema、不执行迁移、不删除 TypeORM。

## 1. 决策

| 项 | 决定 |
| --- | --- |
| 目标数据库 | 只保留 PostgreSQL |
| 目标 ORM | Prisma 7.10.1（`prisma`、`@prisma/client`、`@prisma/adapter-pg` 同一版本）。不用 `prisma@latest`（2026-11-04 注册表标签是 `8.0.0-rc.30`） |
| 存量数据 | 已确认没有需要保留的库。主路径是空库执行 Prisma 初始迁移 |
| 接管已有库 | 写成备用流程，不作为本仓库的验收路径 |
| MongoDB | 在引入 Prisma 之前单独删除，不为文档库写 Prisma schema |
| 阶段 2 的表结构 | 对齐当前 TypeORM 迁移，让现有 `AuthService` 能在不改认证语义的情况下跑通 |
| 阶段 4 的表结构 | 按 [AUTH_DESIGN.md](AUTH_DESIGN.md) 替换 `session`，并新增 `refresh_token`、`auth_audit_event`。那是另一次迁移，不塞进阶段 2 |

## 2. 删除 MongoDB（阶段 2a）

先删文档库，再引入 Prisma。这样阶段 2b 只面对一套实体。

删除或改写的范围：

| 类别 | 路径 |
| --- | --- |
| 文档适配器 | `src/users/infrastructure/persistence/document/`、`src/session/infrastructure/persistence/document/`、`src/files/infrastructure/persistence/document/` |
| 文档种子 | `src/database/seeds/document/` |
| Mongoose 配置 | `src/database/mongoose-config.service.ts` |
| 运行时切换 | `src/app.module.ts`、`src/users/users.module.ts`、`src/session/session.module.ts`、`src/files/files.module.ts`、三个 uploader 模块里的 `// <database-block>` 与 `isDocumentDatabase` |
| 领域主键分支 | `src/users/domain/user.ts`、`src/roles/domain/role.ts`、`src/statuses/domain/status.ts` 里按 `DATABASE_TYPE` 选择 `String` / `Number` 的块。关系库路径上 id 收窄为 `number` |
| 配置 | `src/database/config/database.config.ts` 的 `isDocumentDatabase`；`env-example-document` |
| 容器与脚本 | `docker-compose.document.yaml`、`docker-compose.document.ci.yaml`、`docker-compose.document.test.yaml`、`document.Dockerfile`、`document.e2e.Dockerfile`、`document.test.Dockerfile`、`startup.document.*.sh` |
| CI | `.github/workflows/docker-e2e.yml` 与 `.github/workflows/cli.yml` 里的 document job |
| 生成器 | `.hygen/generate/document-resource/`、`.hygen/generate/all-db-resource/`、`.hygen/property/add-to-document/`、`.hygen/property/add-to-all-db/`、`.hygen/seeds/create-document/` |
| 依赖 | `@nestjs/mongoose`、`mongoose`、`mongoose-autopopulate` |
| 安装脚本 | `.install-scripts/scripts/remove-mongodb.ts`、`remove-postgresql.ts` 随双库选择一起退役，阶段 6 再决定是否整段删除 `.install-scripts` |

保留到阶段 2b 结束：TypeORM 实体、`src/database/migrations/1715028537217-CreateUser.ts`、关系型种子、`relational` 生成器。

API 形状不变：`/api/v1/...`、422 错误体 `{ status, errors }`、JWT 字段名不变。PostgreSQL 上 id 本来就是整数，收窄类型不改变现有关系库的运行时值。

门禁：确认没有外部部署仍在使用 `env-example-document` 之后再删。仓库内没有这种部署的证据。

## 3. 当前 PostgreSQL 结构（对照源）

唯一迁移是 [src/database/migrations/1715028537217-CreateUser.ts](../../src/database/migrations/1715028537217-CreateUser.ts)。下面以这条 SQL 为准，不以来源不明的库导出为准。

| 表 | 列 | 约束 |
| --- | --- | --- |
| `role` | `id integer`，`name varchar NOT NULL` | 主键 `id`，非自增 |
| `status` | 同 `role` | 同 `role` |
| `file` | `id uuid NOT NULL DEFAULT uuid_generate_v4()`，`path varchar NOT NULL` | 主键 `id` |
| `user` | `id SERIAL`，`email varchar`，`password varchar`，`provider varchar NOT NULL DEFAULT 'email'`，`socialId varchar`，`firstName varchar`，`lastName varchar`，`createdAt/updatedAt TIMESTAMP NOT NULL DEFAULT now()`，`deletedAt TIMESTAMP`，`photoId uuid`，`roleId integer`，`statusId integer` | `UNIQUE(email)`，`UNIQUE(photoId)`，主键 `id` |
| `session` | `id SERIAL`，`hash varchar NOT NULL`，三个时间戳，`userId integer` | 主键 `id` |

索引：`user(socialId)`、`user(firstName)`、`user(lastName)`、`session(userId)`。

外键全部是 `ON DELETE NO ACTION ON UPDATE NO ACTION`：

- `user.photoId` → `file.id`
- `user.roleId` → `role.id`
- `user.statusId` → `status.id`
- `session.userId` → `user.id`

已知缺口：

1. `file.id` 的默认值调用 `uuid_generate_v4()`，迁移没有 `CREATE EXTENSION`。干净库上 TypeORM 迁移可能失败。Prisma 初始迁移改用 PostgreSQL 13+ 内置的 `gen_random_uuid()`，不再依赖 `uuid-ossp`。
2. 时间列是不带时区的 `TIMESTAMP`。没有存量数据，阶段 2 改为 `timestamptz(6)`。这是相对 TypeORM 迁移的有意差异，结构对比时记为“已接受”。
3. 实体上 `user.photo`、`user.role`、`user.status`、`session.user` 都是 `eager: true`。Prisma 侧不设默认 include，由仓储显式传入。
4. 没有任何事务。重置密码先改密码哈希再删会话，两步可以只成功一半。
5. 邮箱唯一约束之上还有“先查后插”。并发注册会把唯一冲突变成 500，而不是现在的 422 `emailAlreadyExists`（见 [src/users/users.service.ts](../../src/users/users.service.ts)）。
6. `(provider, socialId)` 没有联合唯一约束。阶段 2 加上，防止并发社交登录建出两个账号。这是新增约束，空库没有历史重复数据要清洗。

## 4. 阶段 2 的 Prisma schema

`@@map` 保持现有表名和列名，避免阶段 2 改 SQL 标识符。`session.hash` 留到阶段 4 再拆走。

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

model Role {
  id    Int     @id
  name  String
  users User[]

  @@map("role")
}

model Status {
  id    Int     @id
  name  String
  users User[]

  @@map("status")
}

model File {
  id    String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  path  String
  users User[]

  @@map("file")
}

model User {
  id        Int       @id @default(autoincrement())
  email     String?   @unique
  password  String?
  provider  String    @default("email")
  socialId  String?
  firstName String?
  lastName  String?
  createdAt DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @db.Timestamptz(6)
  deletedAt DateTime? @db.Timestamptz(6)
  photoId   String?   @unique @db.Uuid
  roleId    Int?
  statusId  Int?
  photo     File?     @relation(fields: [photoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  role      Role?     @relation(fields: [roleId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  status    Status?   @relation(fields: [statusId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  sessions  Session[]

  @@unique([provider, socialId])
  @@index([socialId])
  @@index([firstName])
  @@index([lastName])
  @@map("user")
}

model Session {
  id        Int       @id @default(autoincrement())
  hash      String
  createdAt DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @db.Timestamptz(6)
  deletedAt DateTime? @db.Timestamptz(6)
  userId    Int?
  user      User?     @relation(fields: [userId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([userId])
  @@map("session")
}
```

`moduleFormat` 在阶段 2 用 `cjs`，与当时仍是 CommonJS 的应用一致。阶段 5 改成 `esm` 并重新生成客户端。生成目录 `src/generated/prisma` 不提交，加入 `.gitignore`；CI 在安装后执行 `prisma generate`。

Prisma 7 的连接串放在 `prisma.config.ts`，不写进 `schema.prisma`。应用运行时用 `@prisma/adapter-pg` 创建 `PrismaClient`，连接池参数继续读现有的 `DATABASE_MAX_CONNECTIONS`。

### 4.1 与当前迁移的有意差异

| 项 | 当前 | 阶段 2 | 原因 |
| --- | --- | --- | --- |
| `file.id` 默认值 | `uuid_generate_v4()` | `gen_random_uuid()` | 不依赖未创建的扩展 |
| 时间类型 | `timestamp` | `timestamptz(6)` | 无存量数据，避免时区歧义 |
| `(provider, socialId)` | 无 | 联合唯一 | 并发社交登录 |
| 索引名 | TypeORM 生成的 `IDX_*` / `UQ_*` / `FK_*` | Prisma 默认名 | 空库重建，名称不构成 API |

结构对比时只接受上表里的差异。多出来的列、丢了的列、空值约束变化，都算失败。

## 5. 仓储行为

保留三个端口：`UserRepository`、`SessionRepository`、`FileRepository`。Service 继续注入抽象类。roles、statuses 只有枚举和种子，不建仓储。

Prisma 生成类型停在 mapper 以内。DTO、领域对象、HTTP 响应不引用 `Prisma.UserGetPayload`。

### 5.1 软删除

只有 `User` 和阶段 2 的 `Session` 有 `deletedAt`。不安装全局软删除扩展。每个读方法自己写 `deletedAt: null`。漏写会在仓储单元测试里被一个“已删除记录不可见”的用例抓住。

`User.email` 的唯一约束包含已软删除行，和现在的 TypeORM 行为一致：删掉的邮箱不能再次注册，除非以后单独立项改成部分唯一索引。本轮不改。

`Session` 的删除在阶段 2 仍是软删除，对应现在的 `softDelete`。阶段 4 改为 `revokedAt`，见认证设计。

### 5.2 关联

用固定常量替代 eager，例如：

```ts
const userWithRelations = {
  photo: true,
  role: true,
  status: true,
} as const;
```

列表、详情、登录都显式传入。不在 Prisma Client 上做默认 include。

### 5.3 排序白名单

`orderBy` 只允许 `id`、`email`、`firstName`、`lastName`、`createdAt`。`order` 只允许 `asc`、`desc`（入参仍接受现有的 `ASC` / `DESC`，进仓储前转小写）。非法值由 `class-validator` 返回 422，不把客户端字符串交给 Prisma 的 `orderBy`。

分页维持现有上限：默认 10，最大 50（[src/users/users.controller.ts](../../src/users/users.controller.ts)）。`hasNextPage` 的 off-by-one 在阶段 6 修，阶段 2 先保持 `data.length === limit`，避免同一次 ORM 替换夹带响应语义变化。

### 5.4 唯一约束冲突

捕获 Prisma `P2002`：

- 目标是 `email`：422，`errors.email = 'emailAlreadyExists'`
- 目标是 `(provider, socialId)`：422，沿用现有社交登录的冲突文案；若现有文案没有对应键，新增前先对照 e2e，不发明新的客户端字段

其他 `P2002` 记日志并返回不含堆栈的 500。不把 Prisma 错误原文返回给客户端。

### 5.5 事务

调用点只有少数几处，且都在 `AuthService` 编排两个仓储。默认不引入 `@nestjs-cls/transactional`。

做法：`PrismaService` 暴露 `runInTransaction`。仓储方法增加可选的事务客户端参数；未传入时用基础 client。需要同一事务的流程：

| 流程 | 阶段 | 同一事务里的写入 |
| --- | --- | --- |
| 重置密码 | 2 | 更新密码哈希，软删除该用户全部 session |
| 确认邮箱 | 2 | 把 status 改为 active（单表，事务可选，仍包一层以便以后加审计） |
| 刷新令牌 | 4 | 消费旧 refresh、插入新 refresh、更新 session。阶段 2 仍用现有的条件更新 `hash` |

`@nestjs-cls/transactional` 及其 Prisma 适配器只在调用链深过两层、参数传递开始漏传时再评估，并且要单独批准依赖。

## 6. 空库主路径

在临时数据库上演练，不使用开发者日常库，不执行 `prisma migrate reset`。

1. 用上面的 schema 执行 `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`，输出审阅后保存为 `prisma/migrations/0_init/migration.sql`。
2. 对空库执行 `prisma migrate deploy`。
3. 另起一个空库，用现有 TypeORM 迁移建库（若因缺少 `uuid-ossp` 失败，只在这个对照库执行 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`，并记入对比说明）。
4. 两边 `pg_dump --schema-only`，去掉索引名和扩展语句后做 diff。只允许第 4.1 节列出的差异。
5. 跑关系型 e2e 和新增的仓储单元测试。
6. 漂移检查：`prisma migrate diff --from-migrations --to-schema` 无输出。

种子改为 `prisma/seed.ts`，在 `prisma.config.ts` 的 `migrations.seed` 注册，全部使用 `upsert`：

- role：`1 Admin`、`2 User`
- status：`1 Active`、`2 Inactive`
- 用户：`admin@example.com`（role admin）、`john.doe@example.com`（role user），密码仍是开发用的 `secret`，只允许在非生产 seed 里出现

现有关系型种子 [src/database/seeds/relational/user/user-seed.service.ts](../../src/database/seeds/relational/user/user-seed.service.ts) 把普通用户关联对象的 `role.name` 写成了 `'Admin'`，而 `role.id` 是 `RoleEnum.user`。`firstName` 本身是 `'John'`，没有写错。TypeORM 未设 cascade，这条错误 name 不一定写回 `role` 表。Prisma 种子必须写成 `'User'`，不能照抄。

生产启动不跑 seed。开发 compose 用 profile `seed` 显式执行。

## 7. 接管已有库（备用，本仓库不验收）

仅当以后出现已经执行过 `1715028537217-CreateUser` 的库时使用。

1. 备份。未备份不继续。
2. `prisma migrate diff --from-url "$DATABASE_URL" --to-schema prisma/schema.prisma`。
3. 输出必须为空，或者只包含第 4.1 节已接受、且经人工确认可以在该库执行的语句。有数据的库不要直接把 `timestamp` 改成 `timestamptz`，除非单独评估时区。
4. 差异为零时，执行 `prisma migrate resolve --applied 0_init`，把初始迁移标成已应用，不重放 SQL。
5. 对比迁移前后的行数：`user`、`session`、`file`、`role`、`status`。抽查一封邮箱、一条 session hash、一个 file id。
6. 禁止 `prisma migrate reset`。禁止 `prisma db push` 进入已有数据的环境。

本仓库的 CI 和本地验收不走这条路径。

## 8. TypeORM 退出条件

下面四条全部满足之后，才在阶段 2 的最后一次提交里删除 TypeORM：

1. Prisma 版仓储的单元测试通过。
2. 现有关系型 e2e 通过，包括阶段 2 开始前补上的对照用例：logout、并发注册得到 422 `emailAlreadyExists`、非法排序得到 422。
3. 迁移漂移检查无输出。
4. 临时库上的 schema diff 只含第 4.1 节的差异。

删除清单：

- 依赖：`typeorm`、`@nestjs/typeorm`、`pg` 保留（adapter 仍需要）
- `src/database/data-source.ts`、`src/database/typeorm-config.service.ts`
- `src/**/infrastructure/persistence/relational/`
- `package.json` 里的 `typeorm`、`migration:*`、`schema:drop` 脚本
- 旧迁移文件先复制到 `docs/modernization/archive/1715028537217-CreateUser.ts`，再从 `src/database/migrations/` 删除

退出之前，TypeORM 与 Prisma 可以在同一分支里短暂并存，但应用运行时只能注册一个。并存期限是阶段 2 这一个阶段，不进入阶段 3。

## 9. 回滚

阶段 2a、2b 各自一个 git tag。回滚是回到上一个 tag，而不是在 Prisma 迁移上再写反向迁移。空库可以丢弃重建。备用的已有库路径在执行 `migrate resolve` 之前必须已有备份；该步骤本身不改表，回滚是从备份恢复加上 `DELETE FROM _prisma_migrations WHERE migration_name = '0_init'`。
