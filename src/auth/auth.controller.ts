import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  Post,
  UseGuards,
  Patch,
  Delete,
  SerializeOptions,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service.js';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto.js';
import { AuthForgotPasswordDto } from './dto/auth-forgot-password.dto.js';
import { AuthConfirmEmailDto } from './dto/auth-confirm-email.dto.js';
import { AuthResetPasswordDto } from './dto/auth-reset-password.dto.js';
import { AuthUpdateDto } from './dto/auth-update.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { NullableType } from '../utils/types/nullable.type.js';
import { UserPresenter } from '../users/presenters/user.presenter.js';
import { UserPresenterMapper } from '../users/presenters/user-presenter.mapper.js';
import { RefreshResponseDto } from './dto/refresh-response.dto.js';
import type { RequestWithUser } from '../utils/types/request-with-user.type.js';
import type { JwtPayloadType } from './strategies/types/jwt-payload.type.js';
import { I18nContext } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type.js';
import {
  RefreshTokenGuard,
  RequestWithRefreshToken,
} from './guards/refresh-token.guard.js';
import { AuthCookies } from './auth-cookies.js';
import { AuthClientContext } from './auth.service.js';
import { CookieCsrfGuard } from './guards/cookie-csrf.guard.js';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly cookies: AuthCookies,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly users: UserPresenterMapper,
  ) {}

  @SerializeOptions({
    groups: ['me'],
  })
  @Post('email/login')
  @UseGuards(ThrottlerGuard)
  @ApiOkResponse({
    type: LoginResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() loginDto: AuthEmailLoginDto,
    @Request() request: RequestWithRefreshToken,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.service.validateLogin(loginDto, {
      ...clientContext(request),
      deviceName: loginDto.deviceName,
      deviceType: loginDto.deviceType,
    });
    return await this.presentLogin(result, request, response);
  }

  @Post('email/register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@Body() createUserDto: AuthRegisterLoginDto): Promise<void> {
    return this.service.register(createUserDto, I18nContext.current()?.lang);
  }

  @Post('email/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.service.confirmEmail(confirmEmailDto.hash);
  }

  @Post('email/confirm/new')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmNewEmail(
    @Body() confirmEmailDto: AuthConfirmEmailDto,
  ): Promise<void> {
    return this.service.confirmNewEmail(confirmEmailDto.hash);
  }

  @Post('forgot/password')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(
    @Body() forgotPasswordDto: AuthForgotPasswordDto,
  ): Promise<void> {
    return this.service.forgotPassword(
      forgotPasswordDto.email,
      I18nContext.current()?.lang,
    );
  }

  @Post('reset/password')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() resetPasswordDto: AuthResetPasswordDto): Promise<void> {
    return this.service.resetPassword(
      resetPasswordDto.hash,
      resetPasswordDto.password,
    );
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['me'],
  })
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({
    type: UserPresenter,
  })
  @HttpCode(HttpStatus.OK)
  public me(
    @Request() request: RequestWithUser<JwtPayloadType>,
  ): Promise<NullableType<UserPresenter>> {
    return this.service
      .me(request.user)
      .then((user) => this.users.present(user));
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    type: RefreshResponseDto,
  })
  @SerializeOptions({
    groups: ['me'],
  })
  @Post('refresh')
  @UseGuards(ThrottlerGuard, RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Request() request: RequestWithRefreshToken,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const result = await this.service.refreshToken(request.refreshToken ?? '');
    if (!this.cookieMode(request) || !result.refreshToken) {
      return result;
    }
    this.cookies.write(response, result.refreshToken);
    const { refreshToken, ...rest } = result;
    void refreshToken;
    return rest;
  }

  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(AuthGuard('jwt'), CookieCsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @Request()
    request: RequestWithUser<JwtPayloadType> & RequestWithRefreshToken,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.service.logout({
      id: request.user.id,
      sessionId: request.user.sessionId,
    });
    if (this.cookieMode(request)) {
      this.cookies.clear(response);
    }
  }

  @ApiBearerAuth()
  @Get('sessions')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  public sessions(@Request() request: RequestWithUser<JwtPayloadType>) {
    return this.service.listSessions(request.user.id, request.user.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async revokeSession(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.revokeOwnSession(request.user.id, id);
  }

  @ApiBearerAuth()
  @Post('logout/all')
  @UseGuards(AuthGuard('jwt'), CookieCsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logoutAll(
    @Request()
    request: RequestWithUser<JwtPayloadType> & RequestWithRefreshToken,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.service.revokeAllSessions(
      request.user.id,
      'logout_all',
      'logout_all',
    );
    if (this.cookieMode(request)) {
      this.cookies.clear(response);
    }
  }

  @ApiBearerAuth()
  @SerializeOptions({
    groups: ['me'],
  })
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: UserPresenter,
  })
  public update(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() userDto: AuthUpdateDto,
  ): Promise<NullableType<UserPresenter>> {
    return this.service
      .update(request.user, userDto, I18nContext.current()?.lang)
      .then((user) => this.users.present(user));
  }

  @ApiBearerAuth()
  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @Request() request: RequestWithUser<JwtPayloadType>,
  ): Promise<void> {
    return this.service.softDelete(request.user);
  }

  /**
   * Cookie 模式不把刷新令牌放进 JSON。
   * @param result
   * @param request
   * @param response
   */
  private async presentLogin(
    result: LoginResponseDto,
    request: RequestWithRefreshToken,
    response: Response,
  ): Promise<LoginResponseDto> {
    const user = (await this.users.present(result.user)) ?? result.user;
    const presented = { ...result, user } as LoginResponseDto;
    if (!this.cookieMode(request) || !result.refreshToken) {
      return presented;
    }
    this.cookies.write(response, result.refreshToken);
    const { refreshToken, ...rest } = presented;
    void refreshToken;
    return rest;
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
}

/**
 * 从请求头取出设备和网络信息。不把这些值当作安全判断的唯一依据。
 * @param request
 */
function clientContext(request: RequestWithRefreshToken): AuthClientContext {
  const forwarded = request.headers['x-forwarded-for'];
  const headerIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return {
    userAgent: request.headers['user-agent'] ?? null,
    ip: headerIp?.split(',')[0]?.trim() || null,
  };
}
