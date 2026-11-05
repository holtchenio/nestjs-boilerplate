import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../database/prisma.service.js';
import { UsersPrismaRepository } from './user.repository.js';

const createPayload = {
  email: 'a@b.c',
  password: 'hashed',
  provider: 'email',
  firstName: 'A',
  lastName: 'B',
  socialId: null,
};

/**
 * @param target
 */
function uniqueError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
    meta: { target },
  });
}

describe('UsersPrismaRepository', () => {
  /**
   * @param error
   */
  function repository(error: unknown): UsersPrismaRepository {
    const client = {
      user: {
        create: vi.fn().mockRejectedValue(error),
        findMany: vi.fn(),
      },
    };
    return new UsersPrismaRepository({
      client,
    } as unknown as PrismaService);
  }

  it('should map an email unique conflict to 422 emailAlreadyExists', async () => {
    const repo = repository(uniqueError(['email']));

    await expect(repo.create(createPayload)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    await expect(repo.create(createPayload)).rejects.toMatchObject({
      response: {
        status: 422,
        errors: { email: 'emailAlreadyExists' },
      },
    });
  });

  it('should map a Prisma email constraint name to 422 emailAlreadyExists', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
        meta: {
          driverAdapterError: {
            cause: { constraint: { index: 'user_email_key' } },
          },
        },
      },
    );
    const repo = repository(error);

    await expect(repo.create(createPayload)).rejects.toMatchObject({
      response: {
        errors: { email: 'emailAlreadyExists' },
      },
    });
  });

  it('should rethrow a unique conflict that is not the email', async () => {
    const error = uniqueError(['provider', 'socialId']);
    const repo = repository(error);

    await expect(repo.create(createPayload)).rejects.toBe(error);
  });

  it('should reject an orderBy field outside the whitelist', async () => {
    const repo = repository(new Error('unused'));

    await expect(
      repo.findManyWithPagination({
        sortOptions: [{ orderBy: 'password', order: 'ASC' }],
        paginationOptions: { page: 1, limit: 10 },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
