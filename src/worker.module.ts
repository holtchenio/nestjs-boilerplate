import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { LoggerModule } from 'nestjs-pino';
import path from 'path';
import authConfig from './auth/config/auth.config';
import appleConfig from './auth-apple/config/apple.config';
import facebookConfig from './auth-facebook/config/facebook.config';
import googleConfig from './auth-google/config/google.config';
import redisConfig from './cache/config/redis.config';
import appConfig from './config/app.config';
import { AllConfigType } from './config/config.type';
import databaseConfig from './database/config/database.config';
import { PrismaModule } from './database/prisma.module';
import fileConfig from './files/config/file.config';
import { loggerModuleParams } from './logger/logger.options';
import mailConfig from './mail/config/mail.config';
import { QueueModule } from './queue/queue.module';
import { MailWorkerModule } from './workers/mail/mail-worker.module';

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
    PrismaModule,
    QueueModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
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
  ],
})
export class WorkerModule {}
