import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../cache/redis.service';
import { AllConfigType } from '../config/config.type';

/**
 * 按邮箱和 IP 记录登录失败。达到阈值后，即使密码正确也返回 429。
 */
@Injectable()
export class LoginAttemptService {
  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * @param email
   * @param ip
   */
  async assertAllowed(email: string, ip: string): Promise<void> {
    const count = Number(
      (await this.redis.getClient().get(this.key(email, ip))) ?? '0',
    );
    if (count >= this.limit()) {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * @param email
   * @param ip
   */
  async recordFailure(email: string, ip: string): Promise<void> {
    const key = this.key(email, ip);
    const count = await this.redis.getClient().incr(key);
    if (count === 1) {
      await this.redis.getClient().expire(key, 15 * 60);
    }
    if (count >= this.limit()) {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * @param email
   * @param ip
   */
  async clear(email: string, ip: string): Promise<void> {
    await this.redis.getClient().del(this.key(email, ip));
  }

  /**
   * @param email
   * @param ip
   */
  private key(email: string, ip: string): string {
    return `auth:login-fail:${email}:${ip}`;
  }

  private limit(): number {
    return this.configService.getOrThrow('auth.loginFailLimit', {
      infer: true,
    });
  }
}
