import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { AllConfigType } from '../../config/config.type';
import { RequestWithRefreshToken } from './refresh-token.guard';

/**
 * Cookie 模式下，消费刷新令牌的请求必须带匹配的 CSRF 和允许的 Origin。
 */
@Injectable()
export class CookieCsrfGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /**
   * @param context
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithRefreshToken>();
    const cookieMode =
      this.configService.getOrThrow('auth.cookieEnabled', { infer: true }) &&
      request.headers['x-auth-mode'] === 'cookie';
    if (!cookieMode) {
      return true;
    }
    const origin = request.headers.origin;
    const allowed = this.configService.getOrThrow('app.corsOrigins', {
      infer: true,
    });
    const cookieToken = request.cookies?.csrf_token ?? '';
    const headerToken = request.headers['x-csrf-token'] ?? '';
    if (
      !origin ||
      !allowed.includes(origin) ||
      !cookieToken ||
      !headerToken ||
      !sameToken(cookieToken, headerToken)
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}

/**
 * @param left
 * @param right
 */
function sameToken(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
