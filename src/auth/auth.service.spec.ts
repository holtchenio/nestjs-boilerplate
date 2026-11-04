import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { SessionService } from '../session/session.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { User } from '../users/domain/user';

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
        {} as MailService,
        configService,
        prisma,
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
