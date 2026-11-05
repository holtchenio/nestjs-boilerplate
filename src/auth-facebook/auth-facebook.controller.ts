import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { AuthFacebookService } from './auth-facebook.service.js';
import { AuthFacebookLoginDto } from './dto/auth-facebook-login.dto.js';
import { LoginResponseDto } from '../auth/dto/login-response.dto.js';
import { UserPresenterMapper } from '../users/presenters/user-presenter.mapper.js';

@ApiTags('Auth')
@Controller({
  path: 'auth/facebook',
  version: '1',
})
export class AuthFacebookController {
  constructor(
    private readonly authService: AuthService,
    private readonly authFacebookService: AuthFacebookService,
    private readonly users: UserPresenterMapper,
  ) {}

  @ApiOkResponse({
    type: LoginResponseDto,
  })
  @SerializeOptions({
    groups: ['me'],
  })
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: AuthFacebookLoginDto,
  ): Promise<LoginResponseDto> {
    const socialData =
      await this.authFacebookService.getProfileByToken(loginDto);

    const result = await this.authService.validateSocialLogin(
      'facebook',
      socialData,
    );
    const user = (await this.users.present(result.user)) ?? result.user;
    return { ...result, user } as LoginResponseDto;
  }
}
