import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import redisConfig from './cache/config/redis.config';
import { loggerModuleParams } from './logger/logger.options';
import { QueueModule } from './queue/queue.module';
import { MailWorkerModule } from './workers/mail/mail-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig],
      envFilePath: ['.env'],
    }),
    LoggerModule.forRoot(loggerModuleParams()),
    QueueModule,
    MailWorkerModule,
  ],
})
export class WorkerModule {}
