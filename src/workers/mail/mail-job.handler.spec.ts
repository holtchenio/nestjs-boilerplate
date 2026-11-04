import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/domain/user';
import { MailJobHandler } from './mail-job.handler';

describe('MailJobHandler', () => {
  const user = {
    id: 3,
    email: 'ada@example.com',
    password: 'stored-hash',
  } as User;

  it('should sign the reset link with the current password hash', async () => {
    const signAsync = jest.fn().mockResolvedValue('signed-token');
    const forgotPassword = jest.fn().mockResolvedValue(undefined);
    const handler = new MailJobHandler(
      {
        findById: jest.fn().mockResolvedValue(user),
      } as unknown as UsersService,
      { signAsync } as unknown as JwtService,
      { forgotPassword } as unknown as MailService,
      {
        getOrThrow: jest.fn().mockImplementation((key: string) => {
          if (key === 'auth.forgotSecret') {
            return 'forgot-secret';
          }
          return '30m';
        }),
      } as unknown as ConfigService,
    );

    await handler.handle({
      kind: 'forgot-password',
      userId: user.id,
      lang: 'en',
    });

    expect(signAsync).toHaveBeenCalledWith(
      { forgotUserId: user.id },
      expect.objectContaining({
        secret: 'forgot-secretstored-hash',
      }),
    );
    expect(forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        lang: 'en',
        data: expect.objectContaining({ hash: 'signed-token' }),
      }),
    );
  });
});
