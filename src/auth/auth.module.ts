import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AnonymousStrategy } from './strategies/anonymous.strategy';
import { AuthCookies } from './auth-cookies';
import { LoginAttemptService } from './login-attempt';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { CookieCsrfGuard } from './guards/cookie-csrf.guard';
import { SessionModule } from '../session/session.module';
import { UsersModule } from '../users/users.module';

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
