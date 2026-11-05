import { type Mock } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { MailQueueService } from '../queue/mail-queue.service.js';
import { SessionRevocationCache } from '../session/session-revocation.cache.js';
import { LoginAttemptService } from './login-attempt.js';
import { SessionService } from '../session/session.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/domain/user.js';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto.js';

describe('AuthService.resetPassword', () => {
  const user = {
    id: 7,
    email: 'john.doe@example.com',
    password: 'old-hash',
  } as User;
  const tx = { kind: 'transaction' };

  /**
   * @param update
   */
  function service(update: Mock): {
    auth: AuthService;
    session: { deleteByUserId: Mock };
  } {
    const jwtService = {
      decode: vi.fn().mockReturnValue({ forgotUserId: user.id }),
      verifyAsync: vi.fn().mockResolvedValue({}),
    } as unknown as JwtService;
    const usersService = {
      findById: vi.fn().mockResolvedValue(user),
      update,
    } as unknown as UsersService;
    const session = {
      deleteByUserId: vi.fn().mockResolvedValue([]),
      recordAudit: vi.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      runInTransaction: vi.fn(
        async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      ),
    } as unknown as PrismaService;
    const configService = {
      getOrThrow: vi.fn().mockReturnValue('forgot-secret'),
    } as unknown as ConfigService;

    return {
      auth: new AuthService(
        jwtService,
        usersService,
        session as unknown as SessionService,
        configService,
        prisma,
        { enqueue: vi.fn() } as unknown as MailQueueService,
        { revoke: vi.fn() } as unknown as SessionRevocationCache,
        {
          assertAllowed: vi.fn(),
          recordFailure: vi.fn(),
          clear: vi.fn(),
        } as unknown as LoginAttemptService,
      ),
      session,
    };
  }

  it('should update the password and delete sessions on the same transaction client', async () => {
    const update = vi.fn().mockResolvedValue(user);
    const { auth, session } = service(update);

    await auth.resetPassword('token', 'new-secret');

    expect(session.deleteByUserId).toHaveBeenCalledWith(
      { userId: user.id, reason: 'password_reset' },
      tx,
    );
    expect(update).toHaveBeenCalledWith(user.id, user, tx);
    expect(user.password).toBe('new-secret');
  });

  it('should reject the transaction when the password update fails', async () => {
    const update = vi.fn().mockRejectedValue(new Error('update failed'));
    const { auth, session } = service(update);

    await expect(auth.resetPassword('token', 'new-secret')).rejects.toThrow(
      'update failed',
    );
    expect(session.deleteByUserId).toHaveBeenCalledWith(
      { userId: user.id, reason: 'password_reset' },
      tx,
    );
    expect(update).toHaveBeenCalledWith(user.id, user, tx);
  });
});

describe('AuthService.register', () => {
  it('should enqueue a confirm-email job without a token', async () => {
    const enqueue = vi.fn().mockResolvedValue('mail:confirm-email:3:1');
    const auth = new AuthService(
      { signAsync: vi.fn() } as unknown as JwtService,
      {
        create: vi.fn().mockResolvedValue({ id: 3 }),
      } as unknown as UsersService,
      {} as SessionService,
      {
        getOrThrow: vi.fn().mockReturnValue('en'),
      } as unknown as ConfigService,
      {} as PrismaService,
      { enqueue } as unknown as MailQueueService,
      { revoke: vi.fn() } as unknown as SessionRevocationCache,
      {
        assertAllowed: vi.fn(),
        recordFailure: vi.fn(),
        clear: vi.fn(),
      } as unknown as LoginAttemptService,
    );

    await auth.register(
      {
        email: 'ada@example.com',
        password: 'secret',
      } as AuthRegisterLoginDto,
      'zh',
    );

    expect(enqueue).toHaveBeenCalledWith({
      kind: 'confirm-email',
      userId: 3,
      lang: 'zh',
    });
    expect(JSON.stringify(enqueue.mock.calls)).not.toContain('hash');
    expect(JSON.stringify(enqueue.mock.calls)).not.toContain('secret');
  });
});

describe('AuthService.refreshToken', () => {
  it('should revoke the session when a consumed token is reused with grace 0', async () => {
    const session = {
      findRefreshByHash: vi.fn().mockResolvedValue({
        id: 'refresh-1',
        sessionId: 'session-1',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: new Date(),
        revokedAt: null,
        replacedById: 'refresh-2',
        sessionRevokedAt: null,
        sessionExpiresAt: new Date(Date.now() + 60_000),
        userId: 7,
      }),
      findRefreshById: vi.fn(),
      revokeFamily: vi.fn(),
      recordAudit: vi.fn(),
    };
    const auth = new AuthService(
      {} as JwtService,
      {} as UsersService,
      session as unknown as SessionService,
      {
        getOrThrow: vi.fn((key: string) =>
          key === 'auth.reuseGraceSeconds' ? 0 : 'secret_for_refresh',
        ),
      } as unknown as ConfigService,
      {
        runInTransaction: vi.fn(
          async (fn: (client: object) => Promise<unknown>) => fn({}),
        ),
      } as unknown as PrismaService,
      {} as MailQueueService,
      { revoke: vi.fn() } as unknown as SessionRevocationCache,
      {
        assertAllowed: vi.fn(),
        recordFailure: vi.fn(),
        clear: vi.fn(),
      } as unknown as LoginAttemptService,
    );

    await expect(auth.refreshToken('plain-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(session.revokeFamily).toHaveBeenCalledWith('session-1', 'reuse', {});
    expect(session.findRefreshById).not.toHaveBeenCalled();
  });
});
