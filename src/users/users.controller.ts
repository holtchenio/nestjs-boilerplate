import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  SerializeOptions,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator.js';
import { RoleEnum } from '../roles/roles.enum.js';
import { AuthGuard } from '@nestjs/passport';

import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto.js';
import { NullableType } from '../utils/types/nullable.type.js';
import { QueryUserDto } from './dto/query-user.dto.js';
import { User } from './domain/user.js';
import { UsersService } from './users.service.js';
import { UserPresenter } from './presenters/user.presenter.js';
import { UserPresenterMapper } from './presenters/user-presenter.mapper.js';
import { RolesGuard } from '../roles/roles.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { infinityPagination } from '../utils/infinity-pagination.js';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Users')
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly users: UserPresenterMapper,
  ) {}

  @ApiCreatedResponse({
    type: UserPresenter,
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProfileDto: CreateUserDto,
  ): Promise<UserPresenter | null> {
    return this.users.present(await this.usersService.create(createProfileDto));
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(UserPresenter),
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryUserDto,
  ): Promise<InfinityPaginationResponseDto<UserPresenter>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.users.presentMany(
        await this.usersService.findManyWithPagination({
          filterOptions: query?.filters,
          sortOptions: query?.sort,
          paginationOptions: {
            page,
            limit,
          },
        }),
      ),
      { page, limit },
    );
  }

  @ApiOkResponse({
    type: UserPresenter,
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  async findOne(
    @Param('id') id: User['id'],
  ): Promise<NullableType<UserPresenter>> {
    return this.users.present(await this.usersService.findById(id));
  }

  @ApiOkResponse({
    type: UserPresenter,
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  async update(
    @Param('id') id: User['id'],
    @Body() updateProfileDto: UpdateUserDto,
  ): Promise<UserPresenter | null> {
    return this.users.present(
      await this.usersService.update(id, updateProfileDto),
    );
  }

  @Delete(':id/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  revokeSessions(@Param('id') id: User['id']): Promise<void> {
    return this.authService.revokeAllSessions(id, 'admin', 'session_revoked');
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: User['id']): Promise<void> {
    return this.usersService.remove(id);
  }
}
