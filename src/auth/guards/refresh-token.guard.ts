import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export type RequestWithRefreshToken = {
  headers: { authorization?: string };
  refreshToken?: string;
};

/**
 * 从 Authorization Bearer 取出不透明刷新令牌，不校验 JWT。
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  /**
   * @param context
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithRefreshToken>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException();
    }
    request.refreshToken = token;
    return true;
  }
}
