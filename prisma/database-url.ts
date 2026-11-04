/**
 * 优先用 DATABASE_URL，否则用拆开的主机配置。容器里主机名来自 DATABASE_HOST。
 * @param env
 */
export function databaseUrlFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  const username = encodeURIComponent(env.DATABASE_USERNAME ?? 'root');
  const password = encodeURIComponent(env.DATABASE_PASSWORD ?? 'secret');
  const host = env.DATABASE_HOST ?? 'localhost';
  const port = env.DATABASE_PORT ?? '5432';
  const name = env.DATABASE_NAME ?? 'api';
  return `postgresql://${username}:${password}@${host}:${port}/${name}`;
}
