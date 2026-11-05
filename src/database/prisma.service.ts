import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { AllConfigType } from '../config/config.type.js';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

export type DbClient = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    const adapter = new PrismaPg({
      connectionString: resolveDatabaseUrl(this.configService),
      max: this.configService.get('database.maxConnections', { infer: true }),
    });
    this.client = new PrismaClient({ adapter });
  }

  /**
   * 应用启动时建立数据库连接。
   */
  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  /**
   * 应用关闭时断开数据库连接。
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * 在一个数据库事务里执行回调。
   * @param fn
   */
  runInTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(fn);
  }
}

/**
 * 优先使用 DATABASE_URL，否则用拆开的主机配置拼出连接串。
 * @param configService
 */
function resolveDatabaseUrl(
  configService: ConfigService<AllConfigType>,
): string {
  const url = configService.get('database.url', { infer: true });
  if (url) {
    return url;
  }

  const username = encodeURIComponent(
    configService.get('database.username', { infer: true }) ?? '',
  );
  const password = encodeURIComponent(
    configService.get('database.password', { infer: true }) ?? '',
  );
  const host =
    configService.get('database.host', { infer: true }) ?? 'localhost';
  const port = configService.get('database.port', { infer: true }) ?? 5432;
  const name = configService.get('database.name', { infer: true }) ?? 'api';

  return `postgresql://${username}:${password}@${host}:${port}/${name}`;
}
