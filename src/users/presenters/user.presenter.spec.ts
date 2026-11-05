import { instanceToPlain } from 'class-transformer';
import { UserPresenter } from './user.presenter.js';

describe('UserPresenter', () => {
  const presenter = Object.assign(new UserPresenter(), {
    id: 1,
    email: 'a@b.c',
    password: 'secret',
    provider: 'email',
    firstName: 'A',
    lastName: 'B',
    createdAt: new Date('2026-11-05T00:00:00.000Z'),
    updatedAt: new Date('2026-11-05T00:00:00.000Z'),
  });

  it('should hide email and password when no group is set', () => {
    const plain = instanceToPlain(presenter);

    expect(plain.email).toBeUndefined();
    expect(plain.password).toBeUndefined();
    expect(plain.firstName).toBe('A');
  });

  it('should show email to the me group and still hide the password', () => {
    const plain = instanceToPlain(presenter, { groups: ['me'] });

    expect(plain.email).toBe('a@b.c');
    expect(plain.password).toBeUndefined();
  });
});
