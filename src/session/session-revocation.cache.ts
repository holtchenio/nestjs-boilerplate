import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { RedisService } from '../cache/redis.service.js';
import { AllConfigType } from '../config/config.type.js';

/**
 * Access Token 剩余寿命内的会话撤销缓存。PostgreSQL 仍是权威来源。
 */
@Injectable()
export class SessionRevocationCache {
  private readonly logger = new Logger(SessionRevocationCache.name);

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * 写入撤销标记。Redis 故障时只记日志，不把登出失败掉。
   * @param sessionIds
   * @param reason
   */
  async revoke(sessionIds: string[], reason: string): Promise<void> {
    if (sessionIds.length === 0) {
      return;
    }
    const ttl = ms(
      this.configService.getOrThrow('auth.expires', { infer: true }),
    );
    const ttlSeconds = Math.max(1, Math.ceil(Number(ttl) / 1000));
    try {
      const client = this.redis.getClient();
      await Promise.all(
        sessionIds.map((sessionId) =>
          client.set(this.key(sessionId), reason, 'EX', ttlSeconds),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Redis revocation write failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  /**
   * 读取撤销标记。连接失败时返回 unavailable，调用方改查数据库。
   * @param sessionId
   */
  async read(
    sessionId: string,
  ): Promise<'revoked' | 'missing' | 'unavailable'> {
    try {
      const value = await this.redis.getClient().get(this.key(sessionId));
      return value ? 'revoked' : 'missing';
    } catch (error) {
      this.logger.warn(
        `Redis revocation read failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return 'unavailable';
    }
  }

  /**
   * @param sessionId
   */
  private key(sessionId: string): string {
    return `auth:revoked-session:${sessionId}`;
  }
}
