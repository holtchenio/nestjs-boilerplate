import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { AllConfigType } from '../../config/config.type';

export type RequestWithRefreshToken = {
  headers: {
    authorization?: string;
    origin?: string;
    'user-agent'?: string;
    'x-forwarded-for'?: string | string[];
    'x-auth-mode'?: string;
    'x-csrf-token'?: string;
  };
  cookies?: Record<string, string | undefined>;
  refreshToken?: string;
};

/**
 * Bearer 取不透明刷新令牌。Cookie 模式改读 Cookie，并校验 CSRF 与 Origin。
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /**
   * @param context
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithRefreshToken>();
    if (this.cookieMode(request)) {
      this.assertCookieRequest(request);
      const token = request.cookies?.refresh_token ?? '';
      if (!token) {
        throw new UnauthorizedException();
      }
      request.refreshToken = token;
      return true;
    }

    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException();
    }
    request.refreshToken = token;
    return true;
  }

  /**
   * @param request
   */
  private cookieMode(request: RequestWithRefreshToken): boolean {
    return (
      this.configService.getOrThrow('auth.cookieEnabled', { infer: true }) &&
      request.headers['x-auth-mode'] === 'cookie'
    );
  }

  /**
   * @param request
   */
  private assertCookieRequest(request: RequestWithRefreshToken): void {
    const origin = request.headers.origin;
    const allowed = this.configService.getOrThrow('app.corsOrigins', {
      infer: true,
    });
    if (!origin || !allowed.includes(origin)) {
      throw new ForbiddenException();
    }
    const cookieToken = request.cookies?.csrf_token ?? '';
    const headerToken = request.headers['x-csrf-token'] ?? '';
    if (!cookieToken || !headerToken || !sameToken(cookieToken, headerToken)) {
      throw new ForbiddenException();
    }
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
