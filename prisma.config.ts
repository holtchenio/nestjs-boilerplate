import { defineConfig } from 'prisma/config';

/**
 * 优先用 DATABASE_URL，否则用拆开的主机配置。容器里主机名是 postgres。
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const username = encodeURIComponent(process.env.DATABASE_USERNAME ?? 'root');
  const password = encodeURIComponent(process.env.DATABASE_PASSWORD ?? 'secret');
  const host = process.env.DATABASE_HOST ?? 'localhost';
  const port = process.env.DATABASE_PORT ?? '5432';
  const name = process.env.DATABASE_NAME ?? 'api';
  return `postgresql://${username}:${password}@${host}:${port}/${name}`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl(),
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
