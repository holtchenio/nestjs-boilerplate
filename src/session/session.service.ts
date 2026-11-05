import { Injectable } from '@nestjs/common';
import { DbClient } from '../database/prisma.service';
import { User } from '../users/domain/user';
import { NullableType } from '../utils/types/nullable.type';
import { Session } from './domain/session';
import {
  AuditEventDraft,
  RefreshTokenRecord,
  SessionDraft,
  SessionRepository,
} from './infrastructure/persistence/session.repository';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  findById(id: Session['id']): Promise<NullableType<Session>> {
    return this.sessionRepository.findById(id);
  }

  /**
   * @param data
   * @param db
   */
  create(data: SessionDraft, db?: DbClient): Promise<Session> {
    return this.sessionRepository.create(data, db);
  }

  /**
   * @param id
   * @param reason
   * @param db
   */
  deleteById(id: Session['id'], reason: string, db?: DbClient): Promise<void> {
    return this.sessionRepository.deleteById(id, reason, db);
  }

  /**
   * 撤销该用户的全部会话，返回被撤销的会话 id。
   * @param conditions
   * @param db
   */
  deleteByUserId(
    conditions: { userId: User['id']; reason: string },
    db?: DbClient,
  ): Promise<string[]> {
    return this.sessionRepository.deleteByUserId(conditions, db);
  }

  /**
   * @param conditions
   * @param db
   */
  deleteByUserIdWithExclude(
    conditions: {
      userId: User['id'];
      excludeSessionId: Session['id'];
      reason: string;
    },
    db?: DbClient,
  ): Promise<string[]> {
    return this.sessionRepository.deleteByUserIdWithExclude(conditions, db);
  }

  /**
   * @param data
   * @param db
   */
  issueRefresh(
    data: { sessionId: string; tokenHash: string; expiresAt: Date },
    db?: DbClient,
  ): Promise<{ id: string }> {
    return this.sessionRepository.issueRefresh(data, db);
  }

  /**
   * @param tokenHash
   * @param db
   */
  findRefreshByHash(
    tokenHash: string,
    db?: DbClient,
  ): Promise<RefreshTokenRecord | null> {
    return this.sessionRepository.findRefreshByHash(tokenHash, db);
  }

  /**
   * @param id
   * @param db
   */
  findRefreshById(
    id: string,
    db?: DbClient,
  ): Promise<{ consumedAt: Date | null; revokedAt: Date | null } | null> {
    return this.sessionRepository.findRefreshById(id, db);
  }

  /**
   * @param id
   * @param replacedById
   * @param db
   */
  consumeRefresh(
    id: string,
    replacedById: string,
    db?: DbClient,
  ): Promise<number> {
    return this.sessionRepository.consumeRefresh(id, replacedById, db);
  }

  /**
   * @param sessionId
   * @param reason
   * @param db
   */
  revokeFamily(
    sessionId: string,
    reason: string,
    db?: DbClient,
  ): Promise<void> {
    return this.sessionRepository.revokeFamily(sessionId, reason, db);
  }

  /**
   * @param sessionId
   * @param db
   */
  touchLastUsed(sessionId: string, db?: DbClient): Promise<void> {
    return this.sessionRepository.touchLastUsed(sessionId, db);
  }

  /**
   * @param event
   * @param db
   */
  recordAudit(event: AuditEventDraft, db?: DbClient): Promise<void> {
    return this.sessionRepository.recordAudit(event, db);
  }
}
