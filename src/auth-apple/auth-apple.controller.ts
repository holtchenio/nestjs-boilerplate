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
import { AuthAppleService } from './auth-apple.service.js';
import { AuthAppleLoginDto } from './dto/auth-apple-login.dto.js';
import { LoginResponseDto } from '../auth/dto/login-response.dto.js';
import { UserPresenterMapper } from '../users/presenters/user-presenter.mapper.js';

@ApiTags('Auth')
@Controller({
  path: 'auth/apple',
  version: '1',
})
export class AuthAppleController {
  constructor(
    private readonly authService: AuthService,
    private readonly authAppleService: AuthAppleService,
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
  async login(@Body() loginDto: AuthAppleLoginDto): Promise<LoginResponseDto> {
    const socialData = await this.authAppleService.getProfileByToken(loginDto);

    const result = await this.authService.validateSocialLogin(
      'apple',
      socialData,
    );
    const user = (await this.users.present(result.user)) ?? result.user;
    return { ...result, user } as LoginResponseDto;
  }
}
