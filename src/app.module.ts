import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module.js';
import { FilesModule } from './files/files.module.js';
import { AuthModule } from './auth/auth.module.js';
import databaseConfig from './database/config/database.config.js';
import authConfig from './auth/config/auth.config.js';
import appConfig from './config/app.config.js';
import mailConfig from './mail/config/mail.config.js';
import fileConfig from './files/config/file.config.js';
import facebookConfig from './auth-facebook/config/facebook.config.js';
import googleConfig from './auth-google/config/google.config.js';
import appleConfig from './auth-apple/config/apple.config.js';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthAppleModule } from './auth-apple/auth-apple.module.js';
import { AuthFacebookModule } from './auth-facebook/auth-facebook.module.js';
import { AuthGoogleModule } from './auth-google/auth-google.module.js';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { MailModule } from './mail/mail.module.js';
import { HomeModule } from './home/home.module.js';
import { AllConfigType } from './config/config.type.js';
import { SessionModule } from './session/session.module.js';
import { MailerModule } from './mailer/mailer.module.js';
import { PrismaModule } from './database/prisma.module.js';
import redisConfig from './cache/config/redis.config.js';
import { RedisModule } from './cache/redis.module.js';
import { LoggerModule } from 'nestjs-pino';
import { loggerModuleParams } from './logger/logger.options.js';
import { QueueModule } from './queue/queue.module.js';
import { HealthModule } from './health/health.module.js';
import { authThrottlerModule } from './cache/redis-throttler.storage.js';

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
    QueueModule,
    PrismaModule,
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
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    HealthModule,
  ],
})
export class AppModule {}
