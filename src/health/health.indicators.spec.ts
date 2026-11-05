import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../cache/redis.service.js';
import { checkDatabase, checkRedis } from './health.indicators.js';

describe('health indicators', () => {
  it('should report the database as up after SELECT 1', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const result = await checkDatabase({
      client: { $queryRaw: queryRaw },
    } as unknown as PrismaService);

    expect(result).toEqual({ database: { status: 'up' } });
    expect(JSON.stringify(result)).not.toContain('postgres');
  });

  it('should report Redis as up after PONG', async () => {
    const result = await checkRedis({
      getClient: () => ({ ping: vi.fn().mockResolvedValue('PONG') }),
    } as unknown as RedisService);

    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('should fail when Redis does not answer PONG', async () => {
    await expect(
      checkRedis({
        getClient: () => ({ ping: vi.fn().mockResolvedValue('LOADING') }),
      } as unknown as RedisService),
    ).resolves.toEqual({ redis: { status: 'down' } });
  });
});
