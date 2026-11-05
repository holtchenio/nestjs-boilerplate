import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * 生产环境不挂 Swagger，因此可以打开 Helmet 的 CSP。
 * @param nodeEnv
 */
export function isSwaggerEnabled(nodeEnv: string): boolean {
  return nodeEnv !== 'production';
}

/**
 * 生产环境或 Cookie 模式拒绝 CORS 通配。
 * @param nodeEnv
 * @param origins
 * @param cookieEnabled
 */
export function assertCorsOrigins(
  nodeEnv: string,
  origins: string[],
  cookieEnabled: boolean,
): void {
  if ((cookieEnabled || nodeEnv === 'production') && origins.includes('*')) {
    throw new Error(
      'APP_CORS_ORIGINS cannot contain * when cookie auth or production is enabled',
    );
  }
}

/**
 * @param app
 * @param nodeEnv
 * @param headerLanguage
 */
export function mountSwagger(
  app: INestApplication,
  nodeEnv: string,
  headerLanguage: string,
): void {
  if (!isSwaggerEnabled(nodeEnv)) {
    return;
  }
  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: headerLanguage,
      schema: {
        example: 'en',
      },
    })
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, options));
}
