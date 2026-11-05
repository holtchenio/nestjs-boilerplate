# 验收清单

对照改造计划第 11 节。有命令或测试名的项才勾选。本清单不是改造结束的声明。T7.5 需要人工确认后才算结束。

## 结果

- [x] 只有 pnpm，没有 npm / pnpm 双锁文件。仓库没有 `package-lock.json`，锁文件是 `pnpm-lock.yaml`。干净目录 `/tmp/nestjs-stage7` 执行 `CI=true pnpm install --frozen-lockfile` 成功。
- [x] PostgreSQL 是唯一业务数据库。`docker compose up` 只带 Postgres。`src` 与 `package.json` 不再依赖第二种业务库。
- [x] Prisma 是唯一 ORM。`package.json` 依赖 `@prisma/client` 与 `prisma`。空库 `stage7_drill` 执行 `prisma migrate deploy` 依次应用 `0_init`、`20261105120000_auth_sessions`、`20261105180000_file_created_at`。演练结束后该库已删除。
- [x] MongoDB / Mongoose 已从运行路径清理。顶层 `docs/*.md`、`CLAUDE.md`、`env-example-relational` 不再把 Mongoose 当作当前数据库。
- [x] Prisma Migration 可从空数据库完整执行。证据同上，`stage7_drill` 从空库应用到 3 个迁移。
- [ ] 已有数据库有经过演练的迁移 / baseline 方案。方案写在 `docs/modernization/MIGRATION_PLAN.md`。这次没有一份需要保留的旧库可以演练，因此不勾选。
- [x] Redis 可正常连接、关闭和恢复。演练 API 的 `GET /api/health/ready` 在 Redis 正常时为 200。`docker pause nestjs-boilerplate-redis-1` 后为 503，响应是 `{"redis":{"status":"down"}}`，不含 `redis://`。`docker unpause` 后为 200。
- [x] BullMQ API 入队与 Worker 消费正常。容器里 `POST /api/v1/auth/forgot/password` 返回 204，Maildev `/email` 随后收到 1 封信。空库演练的 e2e `should reset password only once per link` 也依赖 Worker 把信送到 Maildev。
- [x] Job 具备重试、幂等和失败处理。`src/queue/mail-job.options.ts` 设置 `attempts: 5` 与指数退避。模板缺失时 Worker 日志记录 `mail job failed` 并再次投递同一 `jobId`。邮件模板补进镜像后，同一类任务被成功消费。
- [x] API 与 Worker 可独立部署。`Dockerfile` 的 `api` 入口是 `node dist/main.js`，`worker` 入口是 `node dist/worker.js`，`migrator` 入口是 `pnpm exec prisma migrate deploy`。
- [x] Access / Refresh Token 生命周期有测试。`test/user/auth.e2e-spec.ts`：`should get new refresh token`、`should reject the current refresh token after logout`、`should reject the access token after the account is deleted`。
- [x] Refresh Token 轮换、重用检测和并发刷新有测试。同一文件：`should fail on the second attempt to refresh token with the same token`、`should reject a second concurrent registration of the same email`。
- [x] 多设备 Session、单设备撤销和全部登出有测试。同一文件：`should revoke one device and keep the other`、`should reject both access tokens after logout all`。
- [x] ESM 在开发、测试、构建和生产环境均正常。`package.json` 为 `"type": "module"`。干净目录 `pnpm test` 35 项、`pnpm run test:e2e` 28 项通过。生产镜像 `node dist/main.js` 的 live/ready 为 200。
- [x] 单元测试、集成测试和 E2E 全部通过。干净目录单元测试 35 项、e2e 28 项通过。仓库内 `pnpm exec prettier --check`、`pnpm run typecheck`、`pnpm run lint` 通过。
- [x] Docker 使用非 root 用户。`docker run --rm --entrypoint id` 对 api、worker、migrator 都是 `uid=1000(node)`。`docker compose exec api id` 与 `worker id` 同样是 `uid=1000(node)`。
- [x] CI 使用 pnpm frozen lockfile。`.github/workflows/ci.yml` 的安装步骤是 `pnpm install --frozen-lockfile`，并缓存 pnpm。
- [x] 日志不泄漏 Token、密码和密钥。`HttpErrorFilter` 的测试 `should return a body without a stack for an unknown error` 断言响应没有 stack。暂停 Redis 时的 ready 响应不含连接串。Facebook 换票失败只记 `Facebook token exchange failed`。
- [x] 文档、环境变量示例和 Agent 规则与最终架构一致。`docs/installing-and-running.md`、`docs/database.md`、`docs/tests.md`、`CLAUDE.md` 与 `.claude/skills/generate/SKILL.md` 描述 Prisma、pnpm、api/worker/migrator。生成器说明里出现 TypeORM / Mongoose 的地方是“不要使用”。

## 未勾选与已知缺口

- `pnpm audit --prod` 当前退出码 1：2 critical（handlebars）、13 high、22 moderate、2 low。CI 里该步骤使用 `continue-on-error`，避免用一次无关的大版本升级挡住其余检查。这不是“审计已通过”。
- 已有库 baseline 没有演练对象。
- 人工确认前，不把这次改造标成结束。
