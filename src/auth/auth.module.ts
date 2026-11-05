import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { AnonymousStrategy } from './strategies/anonymous.strategy.js';
import { AuthCookies } from './auth-cookies.js';
import { LoginAttemptService } from './login-attempt.js';
import { RefreshTokenGuard } from './guards/refresh-token.guard.js';
import { CookieCsrfGuard } from './guards/cookie-csrf.guard.js';
import { SessionModule } from '../session/session.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    SessionModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AnonymousStrategy,
    AuthCookies,
    LoginAttemptService,
    RefreshTokenGuard,
    CookieCsrfGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
