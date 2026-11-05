import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../cache/redis.service.js';

type CheckState = { status: 'up' | 'down' };

/**
 * 数据库存活检查。失败时返回 down，让探针得到 503，响应不含连接串。
 * @param prisma
 */
export async function checkDatabase(
  prisma: PrismaService,
): Promise<{ database: CheckState }> {
  try {
    await prisma.client.$queryRaw`SELECT 1`;
  } catch {
    return { database: { status: 'down' } };
  }
  return { database: { status: 'up' } };
}

/**
 * Redis 存活检查。探测超过 1 秒或不是 PONG 时返回 down。
 * @param redis
 */
export async function checkRedis(
  redis: RedisService,
): Promise<{ redis: CheckState }> {
  try {
    const reply = await withTimeout(redis.getClient().ping(), 1000);
    if (reply !== 'PONG') {
      return { redis: { status: 'down' } };
    }
  } catch {
    return { redis: { status: 'down' } };
  }
  return { redis: { status: 'up' } };
}

/**
 * 给探测一个上限，避免依赖卡住时探针一直挂起。
 * @param promise
 * @param timeoutMs
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Redis ping timed out')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
