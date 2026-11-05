import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../cache/redis.service';
import { LoginAttemptService } from './login-attempt';

describe('LoginAttemptService', () => {
  it('should reject the next attempt after the configured limit', async () => {
    const counts = new Map<string, number>();
    const client = {
      get: jest.fn((key: string) =>
        Promise.resolve(String(counts.get(key) ?? 0)),
      ),
      incr: jest.fn((key: string) => {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return Promise.resolve(next);
      }),
      expire: jest.fn(),
      del: jest.fn(),
    };
    const service = new LoginAttemptService(
      { getClient: () => client } as unknown as RedisService,
      {
        getOrThrow: jest.fn().mockReturnValue(2),
      } as unknown as ConfigService,
    );

    await service.recordFailure('ada@example.com', '127.0.0.1');
    await expect(
      service.recordFailure('ada@example.com', '127.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      service.assertAllowed('ada@example.com', '127.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
