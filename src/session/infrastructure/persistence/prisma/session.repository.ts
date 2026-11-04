import { Injectable } from '@nestjs/common';
import { DbClient, PrismaService } from '../../../../database/prisma.service';
import { User } from '../../../../users/domain/user';
import { NullableType } from '../../../../utils/types/nullable.type';
import { Session } from '../../../domain/session';
import { SessionRepository } from '../session.repository';
import {
  UserMapper,
  userWithRelations,
} from '../../../../users/infrastructure/persistence/prisma/user.mapper';

const sessionWithUser = {
  user: { include: userWithRelations },
} as const;

@Injectable()
export class SessionPrismaRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param id
   * @param db
   */
  async findById(
    id: Session['id'],
    db: DbClient = this.prisma.client,
  ): Promise<NullableType<Session>> {
    const session = await db.session.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: sessionWithUser,
    });
    return session ? toDomain(session) : null;
  }

  /**
   * @param data
   * @param db
   */
  async create(
    data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
    db: DbClient = this.prisma.client,
  ): Promise<Session> {
    const session = await db.session.create({
      data: {
        hash: data.hash,
        user: { connect: { id: Number(data.user.id) } },
      },
      include: sessionWithUser,
    });
    return toDomain(session);
  }

  /**
   * @param id
   * @param payload
   * @param db
   */
  async update(
    id: Session['id'],
    payload: Partial<
      Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    >,
    db: DbClient = this.prisma.client,
  ): Promise<Session | null> {
    const current = await db.session.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!current) {
      throw new Error('Session not found');
    }
    const session = await db.session.update({
      where: { id: current.id },
      data: {
        ...(payload.hash !== undefined ? { hash: payload.hash } : {}),
        ...(payload.user?.id
          ? { user: { connect: { id: Number(payload.user.id) } } }
          : {}),
      },
      include: sessionWithUser,
    });
    return toDomain(session);
  }

  /**
   * @param conditions
   * @param payload
   * @param db
   */
  async updateByHash(
    conditions: { id: Session['id']; hash: Session['hash'] },
    payload: Partial<
      Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    >,
    db: DbClient = this.prisma.client,
  ): Promise<Session | null> {
    const result = await db.session.updateMany({
      where: {
        id: Number(conditions.id),
        hash: conditions.hash,
        deletedAt: null,
      },
      data: {
        ...(payload.hash !== undefined ? { hash: payload.hash } : {}),
      },
    });
    if (result.count !== 1) {
      return null;
    }
    return this.findById(conditions.id, db);
  }

  /**
   * @param id
   * @param db
   */
  async deleteById(
    id: Session['id'],
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.session.updateMany({
      where: { id: Number(id), deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * @param conditions
   * @param db
   */
  async deleteByUserId(
    conditions: { userId: User['id'] },
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.session.updateMany({
      where: { userId: Number(conditions.userId), deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * @param conditions
   * @param db
   */
  async deleteByUserIdWithExclude(
    conditions: {
      userId: User['id'];
      excludeSessionId: Session['id'];
    },
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.session.updateMany({
      where: {
        userId: Number(conditions.userId),
        id: { not: Number(conditions.excludeSessionId) },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }
}

/**
 * @param raw
 */
function toDomain(raw: {
  id: number;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  user: Parameters<typeof UserMapper.toDomain>[0] | null;
}): Session {
  const session = new Session();
  session.id = raw.id;
  if (raw.user) {
    session.user = UserMapper.toDomain(raw.user);
  }
  session.hash = raw.hash;
  session.createdAt = raw.createdAt;
  session.updatedAt = raw.updatedAt;
  session.deletedAt = raw.deletedAt as Date;
  return session;
}
