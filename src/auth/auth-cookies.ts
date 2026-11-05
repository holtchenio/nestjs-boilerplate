import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import ms from 'ms';
import { AllConfigType } from '../config/config.type.js';
import { createRefreshToken } from './refresh-token.js';

/**
 * Cookie 模式下发刷新令牌和可读的 CSRF Cookie。
 */
@Injectable()
export class AuthCookies {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /**
   * @param response
   * @param refreshToken
   */
  write(response: Response, refreshToken: string): string {
    const csrfToken = createRefreshToken();
    const maxAge = Number(
      ms(this.configService.getOrThrow('auth.refreshExpires', { infer: true })),
    );
    response.cookie('refresh_token', refreshToken, {
      ...this.baseOptions(maxAge),
      httpOnly: true,
      path: '/api/v1/auth',
    });
    response.cookie('csrf_token', csrfToken, {
      ...this.baseOptions(maxAge),
      httpOnly: false,
      path: '/',
    });
    return csrfToken;
  }

  /**
   * @param response
   */
  clear(response: Response): void {
    const options = this.baseOptions(0);
    response.clearCookie('refresh_token', {
      ...options,
      httpOnly: true,
      path: '/api/v1/auth',
    });
    response.clearCookie('csrf_token', {
      ...options,
      httpOnly: false,
      path: '/',
    });
  }

  /**
   * @param maxAge
   */
  private baseOptions(maxAge: number): CookieOptions {
    const sameSite = this.configService.getOrThrow('auth.cookieSameSite', {
      infer: true,
    });
    return {
      secure:
        this.configService.getOrThrow('app.nodeEnv', { infer: true }) ===
        'production',
      sameSite: sameSite.toLowerCase() as 'lax' | 'strict' | 'none',
      maxAge,
    };
  }
}
