import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { MailQueueService } from '../queue/mail-queue.service';
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
      deleteByUserId: jest.fn().mockResolvedValue(undefined),
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
      ),
      session,
    };
  }

  it('should update the password and delete sessions on the same transaction client', async () => {
    const update = jest.fn().mockResolvedValue(user);
    const { auth, session } = service(update);

    await auth.resetPassword('token', 'new-secret');

    expect(session.deleteByUserId).toHaveBeenCalledWith(
      { userId: user.id },
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
      { userId: user.id },
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
