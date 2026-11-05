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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import validationOptions from './utils/validation-options.js';
import { AllConfigType } from './config/config.type.js';
import { ResolvePromisesInterceptor } from './utils/serializer.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigins = configService.getOrThrow('app.corsOrigins', {
    infer: true,
  });
  const cookieEnabled = configService.getOrThrow('auth.cookieEnabled', {
    infer: true,
  });
  if (
    (cookieEnabled ||
      configService.getOrThrow('app.nodeEnv', { infer: true }) ===
        'production') &&
    corsOrigins.includes('*')
  ) {
    throw new Error(
      'APP_CORS_ORIGINS cannot contain * when cookie auth or production is enabled',
    );
  }
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
  app.useGlobalInterceptors(
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
      schema: {
        example: 'en',
      },
    })
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);

  await app.listen(configService.getOrThrow('app.port', { infer: true }));
}
void bootstrap();
