import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { FileType } from '../../files/domain/file.js';

export class RolePresenter {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'admin' })
  name?: string;
}

export class StatusPresenter {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'active' })
  name?: string;
}

export class UserPresenter {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String, example: 'john.doe@example.com' })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({ type: String, example: 'email' })
  @Expose({ groups: ['me', 'admin'] })
  provider: string;

  @ApiProperty({ type: String, example: '1234567890' })
  @Expose({ groups: ['me', 'admin'] })
  socialId?: string | null;

  @ApiProperty({ type: String, example: 'John' })
  firstName: string | null;

  @ApiProperty({ type: String, example: 'Doe' })
  lastName: string | null;

  @ApiProperty({ type: () => FileType })
  photo?: FileType | null;

  @ApiProperty({ type: () => RolePresenter })
  role?: RolePresenter | null;

  @ApiProperty({ type: () => StatusPresenter })
  status?: StatusPresenter;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
