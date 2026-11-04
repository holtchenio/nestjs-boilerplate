import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../database/prisma.service';
import { checkDatabase, checkRedis } from './health.indicators';

@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 进程存活。不访问数据库或 Redis。
   */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /**
   * 依赖就绪。检查数据库和 Redis，响应不含连接串。
   */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => checkDatabase(this.prisma),
      () => checkRedis(this.redis),
    ]);
  }
}
