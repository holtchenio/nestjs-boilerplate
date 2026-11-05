import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  DbClient,
  PrismaService,
} from '../../../../database/prisma.service.js';
import { NullableType } from '../../../../utils/types/nullable.type.js';
import { IPaginationOptions } from '../../../../utils/types/pagination-options.js';
import { User } from '../../../domain/user.js';
import { FilterUserDto, SortUserDto } from '../../../dto/query-user.dto.js';
import { UserRepository } from '../user.repository.js';
import { UserMapper, userWithRelations } from './user.mapper.js';

const userSortFields = new Set([
  'id',
  'email',
  'firstName',
  'lastName',
  'createdAt',
]);

@Injectable()
export class UsersPrismaRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param data
   * @param db
   */
  async create(
    data: Omit<User, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
    db: DbClient = this.prisma.client,
  ): Promise<User> {
    try {
      const created = await db.user.create({
        data: {
          email: data.email,
          password: data.password,
          provider: data.provider,
          socialId: data.socialId,
          firstName: data.firstName,
          lastName: data.lastName,
          ...(data.photo?.id
            ? { photo: { connect: { id: data.photo.id } } }
            : {}),
          ...(data.role?.id
            ? { role: { connect: { id: Number(data.role.id) } } }
            : {}),
          ...(data.status?.id
            ? { status: { connect: { id: Number(data.status.id) } } }
            : {}),
        },
        include: userWithRelations,
      });
      return UserMapper.toDomain(created);
    } catch (error) {
      throwMappedUniqueError(error);
    }
  }

  /**
   * @param query
   * @param db
   */
  async findManyWithPagination(
    {
      filterOptions,
      sortOptions,
      paginationOptions,
    }: {
      filterOptions?: FilterUserDto | null;
      sortOptions?: SortUserDto[] | null;
      paginationOptions: IPaginationOptions;
    },
    db: DbClient = this.prisma.client,
  ): Promise<User[]> {
    const roleIds = filterOptions?.roles?.map((role) => Number(role.id)) ?? [];
    const users = await db.user.findMany({
      where: {
        deletedAt: null,
        ...(roleIds.length > 0 ? { roleId: { in: roleIds } } : {}),
      },
      orderBy: toOrderBy(sortOptions),
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit + 1,
      include: userWithRelations,
    });
    return users.map((user) => UserMapper.toDomain(user));
  }

  /**
   * @param id
   * @param db
   */
  async findById(
    id: User['id'],
    db: DbClient = this.prisma.client,
  ): Promise<NullableType<User>> {
    const user = await db.user.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: userWithRelations,
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  /**
   * @param ids
   * @param db
   */
  async findByIds(
    ids: User['id'][],
    db: DbClient = this.prisma.client,
  ): Promise<User[]> {
    const users = await db.user.findMany({
      where: { id: { in: ids.map(Number) }, deletedAt: null },
      include: userWithRelations,
    });
    return users.map((user) => UserMapper.toDomain(user));
  }

  /**
   * @param email
   * @param db
   */
  async findByEmail(
    email: User['email'],
    db: DbClient = this.prisma.client,
  ): Promise<NullableType<User>> {
    if (!email) {
      return null;
    }
    const user = await db.user.findFirst({
      where: { email, deletedAt: null },
      include: userWithRelations,
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  /**
   * @param query
   * @param db
   */
  async findBySocialIdAndProvider(
    {
      socialId,
      provider,
    }: {
      socialId: User['socialId'];
      provider: User['provider'];
    },
    db: DbClient = this.prisma.client,
  ): Promise<NullableType<User>> {
    if (!socialId || !provider) {
      return null;
    }
    const user = await db.user.findFirst({
      where: { socialId, provider, deletedAt: null },
      include: userWithRelations,
    });
    return user ? UserMapper.toDomain(user) : null;
  }

  /**
   * @param id
   * @param payload
   * @param db
   */
  async update(
    id: User['id'],
    payload: Partial<User>,
    db: DbClient = this.prisma.client,
  ): Promise<User | null> {
    const current = await db.user.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!current) {
      throw new Error('User not found');
    }

    try {
      const updated = await db.user.update({
        where: { id: current.id },
        data: toUpdateInput(payload),
        include: userWithRelations,
      });
      return UserMapper.toDomain(updated);
    } catch (error) {
      throwMappedUniqueError(error);
    }
  }

  /**
   * @param id
   * @param db
   */
  async remove(
    id: User['id'],
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.user.updateMany({
      where: { id: Number(id), deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}

/**
 * @param sortOptions
 */
function toOrderBy(
  sortOptions?: SortUserDto[] | null,
): Prisma.UserOrderByWithRelationInput[] {
  return (
    sortOptions?.map((sort) => {
      if (!userSortFields.has(sort.orderBy)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { sort: 'invalidSortField' },
        });
      }
      const direction = sort.order.toLowerCase() === 'desc' ? 'desc' : 'asc';
      return { [sort.orderBy]: direction };
    }) ?? []
  );
}

/**
 * @param payload
 */
function toUpdateInput(payload: Partial<User>): Prisma.UserUpdateInput {
  return {
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.password !== undefined ? { password: payload.password } : {}),
    ...(payload.provider !== undefined ? { provider: payload.provider } : {}),
    ...(payload.socialId !== undefined ? { socialId: payload.socialId } : {}),
    ...(payload.firstName !== undefined
      ? { firstName: payload.firstName }
      : {}),
    ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
    ...(payload.photo === null
      ? { photo: { disconnect: true } }
      : payload.photo?.id
        ? { photo: { connect: { id: payload.photo.id } } }
        : {}),
    ...(payload.role?.id
      ? { role: { connect: { id: Number(payload.role.id) } } }
      : {}),
    ...(payload.status?.id
      ? { status: { connect: { id: Number(payload.status.id) } } }
      : {}),
  };
}

/**
 * 取出唯一约束名。Prisma 7 的 driver adapter 把索引名放在 cause 里。
 * @param error
 */
function uniqueConstraintText(
  error: Prisma.PrismaClientKnownRequestError,
): string {
  const meta = error.meta ?? {};
  const adapter = meta.driverAdapterError as
    | { cause?: { constraint?: { index?: string } } }
    | undefined;
  return [
    ...(Array.isArray(meta.target) ? meta.target.map(String) : []),
    typeof meta.constraint === 'string' ? meta.constraint : '',
    adapter?.cause?.constraint?.index ?? '',
  ].join(' ');
}

/**
 * 把邮箱唯一冲突转成现有的 422 错误体。
 * @param error
 */
function throwMappedUniqueError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = uniqueConstraintText(error);
    if (target.includes('email') && !target.includes('social')) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { email: 'emailAlreadyExists' },
      });
    }
  }
  throw error;
}
