import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /**
   * 取出共享的 Redis 客户端。
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * 应用关闭时断开 Redis。
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
