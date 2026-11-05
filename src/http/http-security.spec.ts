import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertCorsOrigins, mountSwagger } from './http-security.js';

@Controller()
class ProbeController {
  /**
   * 给测试一个确定存在的路由。
   */
  @Get('ok')
  ok(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('http security', () => {
  it('should reject a wildcard origin in production', () => {
    expect(() => assertCorsOrigins('production', ['*'], false)).toThrow(
      /APP_CORS_ORIGINS/,
    );
  });

  it('should not mount swagger in production', async () => {
    const app = await NestFactory.create(ProbeModule, { logger: false });
    mountSwagger(app, 'production', 'x-custom-lang');
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/docs`);
    expect(response.status).toBe(404);
    await app.close();
  });
});
