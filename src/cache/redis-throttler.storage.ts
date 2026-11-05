import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { AllConfigType } from '../config/config.type';
import { RedisService } from './redis.service';

/**
 * Worker 也会装载带 ThrottlerGuard 的 AuthModule，所以两边都要注册。
 */
export function authThrottlerModule() {
  return ThrottlerModule.forRootAsync({
    inject: [ConfigService, RedisService],
    useFactory: (
      configService: ConfigService<AllConfigType>,
      redis: RedisService,
    ) => ({
      throttlers: [
        {
          ttl: 60_000,
          limit: configService.getOrThrow('auth.throttleLimit', {
            infer: true,
          }),
        },
      ],
      storage: new RedisThrottlerStorage(redis),
    }),
  });
}

/**
 * 认证路由的限流计数。键带 TTL，过期后自动消失。
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  /**
   * @param key
   * @param ttl
   * @param limit
   * @param blockDuration
   * @param throttlerName
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    const client = this.redis.getClient();
    const totalHits = await client.incr(redisKey);
    if (totalHits === 1) {
      await client.pexpire(redisKey, ttl);
    }
    const timeToExpire = Math.max(await client.pttl(redisKey), 0);
    const isBlocked = totalHits > limit;
    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.max(blockDuration, timeToExpire) : 0,
    };
  }
}
