import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { LoggerModule } from 'nestjs-pino';
import path from 'path';
import authConfig from './auth/config/auth.config.js';
import appleConfig from './auth-apple/config/apple.config.js';
import facebookConfig from './auth-facebook/config/facebook.config.js';
import googleConfig from './auth-google/config/google.config.js';
import redisConfig from './cache/config/redis.config.js';
import appConfig from './config/app.config.js';
import { AllConfigType } from './config/config.type.js';
import databaseConfig from './database/config/database.config.js';
import { PrismaModule } from './database/prisma.module.js';
import fileConfig from './files/config/file.config.js';
import { loggerModuleParams } from './logger/logger.options.js';
import mailConfig from './mail/config/mail.config.js';
import { authThrottlerModule } from './cache/redis-throttler.storage.js';
import { RedisModule } from './cache/redis.module.js';
import { QueueModule } from './queue/queue.module.js';
import { MailWorkerModule } from './workers/mail/mail-worker.module.js';
import { FileWorkerModule } from './workers/files/file-worker.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        facebookConfig,
        googleConfig,
        appleConfig,
        redisConfig,
      ],
      envFilePath: ['.env'],
    }),
    LoggerModule.forRoot(loggerModuleParams()),
    RedisModule,
    authThrottlerModule(),
    PrismaModule,
    QueueModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: {
          path: path.join(import.meta.dirname, '/i18n/'),
          watch: true,
        },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => [
            configService.get('app.headerLanguage', { infer: true }),
          ],
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    MailWorkerModule,
    FileWorkerModule,
  ],
})
export class WorkerModule {}
