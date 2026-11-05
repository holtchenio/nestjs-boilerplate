import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  DbClient,
  PrismaService,
} from '../../../../database/prisma.service.js';
import { User } from '../../../../users/domain/user.js';
import { NullableType } from '../../../../utils/types/nullable.type.js';
import { Session } from '../../../domain/session.js';
import {
  AuditEventDraft,
  RefreshTokenRecord,
  SessionDraft,
  SessionRepository,
  SessionSummary,
} from '../session.repository.js';
import {
  UserMapper,
  userWithRelations,
} from '../../../../users/infrastructure/persistence/prisma/user.mapper.js';

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
    try {
      const session = await db.session.findFirst({
        where: { id },
        include: sessionWithUser,
      });
      return session?.user ? toDomain(session) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientValidationError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * @param data
   * @param db
   */
  async create(
    data: SessionDraft,
    db: DbClient = this.prisma.client,
  ): Promise<Session> {
    const session = await db.session.create({
      data: {
        expiresAt: data.expiresAt,
        deviceName: data.deviceName ?? null,
        deviceType: data.deviceType ?? null,
        userAgent: clip(data.userAgent),
        ip: data.ip ?? null,
        user: { connect: { id: Number(data.user.id) } },
      },
      include: sessionWithUser,
    });
    return toDomain(session);
  }

  /**
   * @param id
   * @param reason
   * @param db
   */
  async deleteById(
    id: Session['id'],
    reason: string,
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await this.revokeSessions(db, { id }, reason);
  }

  /**
   * @param conditions
   * @param db
   */
  async deleteByUserId(
    conditions: { userId: User['id']; reason: string },
    db: DbClient = this.prisma.client,
  ): Promise<string[]> {
    return this.revokeSessions(
      db,
      { userId: Number(conditions.userId) },
      conditions.reason,
    );
  }

  /**
   * @param conditions
   * @param db
   */
  async deleteByUserIdWithExclude(
    conditions: {
      userId: User['id'];
      excludeSessionId: Session['id'];
      reason: string;
    },
    db: DbClient = this.prisma.client,
  ): Promise<string[]> {
    return this.revokeSessions(
      db,
      {
        userId: Number(conditions.userId),
        id: { not: conditions.excludeSessionId },
      },
      conditions.reason,
    );
  }

  /**
   * @param data
   * @param db
   */
  async issueRefresh(
    data: { sessionId: string; tokenHash: string; expiresAt: Date },
    db: DbClient = this.prisma.client,
  ): Promise<{ id: string }> {
    return db.refreshToken.create({
      data: {
        sessionId: data.sessionId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
      select: { id: true },
    });
  }

  /**
   * @param tokenHash
   * @param db
   */
  async findRefreshByHash(
    tokenHash: string,
    db: DbClient = this.prisma.client,
  ): Promise<RefreshTokenRecord | null> {
    const row = await db.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      sessionId: row.sessionId,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      revokedAt: row.revokedAt,
      replacedById: row.replacedById,
      sessionRevokedAt: row.session.revokedAt,
      sessionExpiresAt: row.session.expiresAt,
      userId: row.session.userId,
    };
  }

  /**
   * @param id
   * @param db
   */
  async findRefreshById(
    id: string,
    db: DbClient = this.prisma.client,
  ): Promise<{ consumedAt: Date | null; revokedAt: Date | null } | null> {
    return db.refreshToken.findUnique({
      where: { id },
      select: { consumedAt: true, revokedAt: true },
    });
  }

  /**
   * @param id
   * @param replacedById
   * @param db
   */
  async consumeRefresh(
    id: string,
    replacedById: string,
    db: DbClient = this.prisma.client,
  ): Promise<number> {
    const result = await db.refreshToken.updateMany({
      where: { id, consumedAt: null, revokedAt: null },
      data: { consumedAt: new Date(), replacedById },
    });
    return result.count;
  }

  /**
   * @param sessionId
   * @param reason
   * @param db
   */
  async revokeFamily(
    sessionId: string,
    reason: string,
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await this.revokeSessions(db, { id: sessionId }, reason);
  }

  /**
   * @param sessionId
   * @param db
   */
  async touchLastUsed(
    sessionId: string,
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.session.updateMany({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * @param event
   * @param db
   */
  /**
   * @param userId
   * @param db
   */
  async listActiveByUserId(
    userId: number,
    db: DbClient = this.prisma.client,
  ): Promise<SessionSummary[]> {
    return db.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * @param userId
   * @param sessionId
   * @param reason
   * @param db
   */
  async revokeOwned(
    userId: number,
    sessionId: string,
    reason: string,
    db: DbClient = this.prisma.client,
  ): Promise<boolean> {
    const row = await db.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, revokedAt: true },
    });
    if (!row) {
      return false;
    }
    if (!row.revokedAt) {
      await this.revokeSessions(db, { id: sessionId, userId }, reason);
    }
    return true;
  }

  async recordAudit(
    event: AuditEventDraft,
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.authAuditEvent.create({
      data: {
        type: event.type,
        userId: event.userId ?? null,
        sessionId: event.sessionId ?? null,
        ip: event.ip ?? null,
        userAgent: clip(event.userAgent),
      },
    });
  }

  /**
   * 撤销仍有效的会话，并作废尚未消费的刷新令牌。
   * @param db
   * @param where
   * @param reason
   */
  private async revokeSessions(
    db: DbClient,
    where: Prisma.SessionWhereInput,
    reason: string,
  ): Promise<string[]> {
    const active = { ...where, revokedAt: null };
    const rows = await db.session.findMany({
      where: active,
      select: { id: true },
    });
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) {
      return [];
    }
    const now = new Date();
    await db.session.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    await db.refreshToken.updateMany({
      where: { sessionId: { in: ids }, consumedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    return ids;
  }
}

/**
 * @param value
 */
function clip(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 512);
}

/**
 * @param raw
 */
function toDomain(raw: {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  user: Parameters<typeof UserMapper.toDomain>[0];
}): Session {
  const session = new Session();
  session.id = raw.id;
  session.user = UserMapper.toDomain(raw.user);
  session.deviceName = raw.deviceName;
  session.deviceType = raw.deviceType;
  session.userAgent = raw.userAgent;
  session.ip = raw.ip;
  session.createdAt = raw.createdAt;
  session.lastUsedAt = raw.lastUsedAt;
  session.expiresAt = raw.expiresAt;
  session.revokedAt = raw.revokedAt;
  session.revokeReason = raw.revokeReason;
  return session;
}
