import { DbClient } from '../../../database/prisma.service';
import { User } from '../../../users/domain/user';
import { NullableType } from '../../../utils/types/nullable.type';
import { Session } from '../../domain/session';

export type SessionDraft = {
  user: User;
  expiresAt: Date;
  deviceName?: string | null;
  deviceType?: string | null;
  userAgent?: string | null;
  ip?: string | null;
};

export type RefreshTokenRecord = {
  id: string;
  sessionId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  replacedById: string | null;
  sessionRevokedAt: Date | null;
  sessionExpiresAt: Date;
  userId: number;
};

export type SessionSummary = {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
};

export type AuditEventDraft = {
  type: string;
  userId?: number | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export abstract class SessionRepository {
  abstract findById(id: Session['id']): Promise<NullableType<Session>>;

  abstract create(data: SessionDraft, db?: DbClient): Promise<Session>;

  /**
   * @param id
   * @param reason
   * @param db
   */
  abstract deleteById(
    id: Session['id'],
    reason: string,
    db?: DbClient,
  ): Promise<void>;

  /**
   * @param conditions
   * @param db
   */
  abstract deleteByUserId(
    conditions: { userId: User['id']; reason: string },
    db?: DbClient,
  ): Promise<string[]>;

  /**
   * @param conditions
   * @param db
   */
  abstract deleteByUserIdWithExclude(
    conditions: {
      userId: User['id'];
      excludeSessionId: Session['id'];
      reason: string;
    },
    db?: DbClient,
  ): Promise<string[]>;

  /**
   * @param data
   * @param db
   */
  abstract issueRefresh(
    data: { sessionId: string; tokenHash: string; expiresAt: Date },
    db?: DbClient,
  ): Promise<{ id: string }>;

  /**
   * @param tokenHash
   * @param db
   */
  abstract findRefreshByHash(
    tokenHash: string,
    db?: DbClient,
  ): Promise<RefreshTokenRecord | null>;

  /**
   * @param id
   * @param db
   */
  abstract findRefreshById(
    id: string,
    db?: DbClient,
  ): Promise<{ consumedAt: Date | null; revokedAt: Date | null } | null>;

  /**
   * @param id
   * @param replacedById
   * @param db
   */
  abstract consumeRefresh(
    id: string,
    replacedById: string,
    db?: DbClient,
  ): Promise<number>;

  /**
   * @param sessionId
   * @param reason
   * @param db
   */
  abstract revokeFamily(
    sessionId: string,
    reason: string,
    db?: DbClient,
  ): Promise<void>;

  /**
   * @param sessionId
   * @param db
   */
  abstract touchLastUsed(sessionId: string, db?: DbClient): Promise<void>;

  /**
   * @param event
   * @param db
   */
  abstract recordAudit(event: AuditEventDraft, db?: DbClient): Promise<void>;

  /**
   * @param userId
   */
  abstract listActiveByUserId(userId: number): Promise<SessionSummary[]>;

  /**
   * 只撤销属于该用户的会话。找不到返回 false。
   * @param userId
   * @param sessionId
   * @param reason
   * @param db
   */
  abstract revokeOwned(
    userId: number,
    sessionId: string,
    reason: string,
    db?: DbClient,
  ): Promise<boolean>;
}
