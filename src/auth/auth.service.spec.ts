import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { MailQueueService } from '../queue/mail-queue.service';
import { SessionRevocationCache } from './session-revocation.cache';
import { SessionService } from '../session/session.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/domain/user';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';

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
  function service(update: jest.Mock): {
    auth: AuthService;
    session: { deleteByUserId: jest.Mock };
  } {
    const jwtService = {
      decode: jest.fn().mockReturnValue({ forgotUserId: user.id }),
      verifyAsync: jest.fn().mockResolvedValue({}),
    } as unknown as JwtService;
    const usersService = {
      findById: jest.fn().mockResolvedValue(user),
      update,
    } as unknown as UsersService;
    const session = {
      deleteByUserId: jest.fn().mockResolvedValue([]),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      runInTransaction: jest.fn(
        async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      ),
    } as unknown as PrismaService;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('forgot-secret'),
    } as unknown as ConfigService;

    return {
      auth: new AuthService(
        jwtService,
        usersService,
        session as unknown as SessionService,
        configService,
        prisma,
        { enqueue: jest.fn() } as unknown as MailQueueService,
        { revoke: jest.fn() } as unknown as SessionRevocationCache,
      ),
      session,
    };
  }

  it('should update the password and delete sessions on the same transaction client', async () => {
    const update = jest.fn().mockResolvedValue(user);
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
    const update = jest.fn().mockRejectedValue(new Error('update failed'));
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
    const enqueue = jest.fn().mockResolvedValue('mail:confirm-email:3:1');
    const auth = new AuthService(
      { signAsync: jest.fn() } as unknown as JwtService,
      {
        create: jest.fn().mockResolvedValue({ id: 3 }),
      } as unknown as UsersService,
      {} as SessionService,
      {
        getOrThrow: jest.fn().mockReturnValue('en'),
      } as unknown as ConfigService,
      {} as PrismaService,
      { enqueue } as unknown as MailQueueService,
      { revoke: jest.fn() } as unknown as SessionRevocationCache,
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
      findRefreshByHash: jest.fn().mockResolvedValue({
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
      findRefreshById: jest.fn(),
      revokeFamily: jest.fn(),
      recordAudit: jest.fn(),
    };
    const auth = new AuthService(
      {} as JwtService,
      {} as UsersService,
      session as unknown as SessionService,
      {
        getOrThrow: jest.fn((key: string) =>
          key === 'auth.reuseGraceSeconds' ? 0 : 'secret_for_refresh',
        ),
      } as unknown as ConfigService,
      {
        runInTransaction: jest.fn(
          async (fn: (client: object) => Promise<unknown>) => fn({}),
        ),
      } as unknown as PrismaService,
      {} as MailQueueService,
      { revoke: jest.fn() } as unknown as SessionRevocationCache,
    );

    await expect(auth.refreshToken('plain-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(session.revokeFamily).toHaveBeenCalledWith('session-1', 'reuse', {});
    expect(session.findRefreshById).not.toHaveBeenCalled();
  });
});
