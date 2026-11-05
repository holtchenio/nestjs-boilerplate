import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user.js';
import { UserPresenter } from '../../users/presenters/user.presenter.js';

export class LoginResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty({ required: false })
  refreshToken?: string;

  @ApiProperty()
  tokenExpires: number;

  @ApiProperty({
    type: () => UserPresenter,
  })
  user: User;
}
