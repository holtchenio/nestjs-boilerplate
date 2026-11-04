import { FileType } from '../../../../files/domain/file';
import { Role } from '../../../../roles/domain/role';
import { Status } from '../../../../statuses/domain/status';
import { Prisma } from '../../../../generated/prisma/client';
import { User } from '../../../domain/user';

export const userWithRelations = {
  photo: true,
  role: true,
  status: true,
} as const;

export type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof userWithRelations;
}>;

export class UserMapper {
  /**
   * 把 Prisma 记录转成领域用户。
   * @param raw
   */
  static toDomain(raw: UserWithRelations): User {
    const domainEntity = new User();
    domainEntity.id = raw.id;
    domainEntity.email = raw.email;
    domainEntity.password = raw.password ?? undefined;
    domainEntity.provider = raw.provider;
    domainEntity.socialId = raw.socialId;
    domainEntity.firstName = raw.firstName;
    domainEntity.lastName = raw.lastName;
    domainEntity.photo = raw.photo ? toFile(raw.photo) : null;
    domainEntity.role = raw.role ? toRole(raw.role) : null;
    domainEntity.status = raw.status ? toStatus(raw.status) : undefined;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    if (raw.deletedAt) {
      domainEntity.deletedAt = raw.deletedAt;
    }
    return domainEntity;
  }
}

/**
 * @param raw
 */
function toFile(raw: { id: string; path: string }): FileType {
  const file = new FileType();
  file.id = raw.id;
  file.path = raw.path;
  return file;
}

/**
 * @param raw
 */
function toRole(raw: { id: number; name: string }): Role {
  const role = new Role();
  role.id = raw.id;
  role.name = raw.name;
  return role;
}

/**
 * @param raw
 */
function toStatus(raw: { id: number; name: string }): Status {
  const status = new Status();
  status.id = raw.id;
  status.name = raw.name;
  return status;
}
