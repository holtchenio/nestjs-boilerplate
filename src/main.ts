import 'dotenv/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { useContainer } from 'class-validator';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import validationOptions from './utils/validation-options.js';
import { AllConfigType } from './config/config.type.js';
import { HttpErrorFilter } from './common/filters/http-exception.filter.js';
import { assertCorsOrigins, mountSwagger } from './http/http-security.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  const nodeEnv = configService.getOrThrow('app.nodeEnv', { infer: true });
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigins = configService.getOrThrow('app.corsOrigins', {
    infer: true,
  });
  const cookieEnabled = configService.getOrThrow('auth.cookieEnabled', {
    infer: true,
  });
  assertCorsOrigins(nodeEnv, corsOrigins, cookieEnabled);
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins.includes('*') ? '*' : corsOrigins,
    credentials: cookieEnabled,
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  mountSwagger(
    app,
    nodeEnv,
    configService.getOrThrow('app.headerLanguage', { infer: true }),
  );

  await app.listen(configService.getOrThrow('app.port', { infer: true }));
}
void bootstrap();
