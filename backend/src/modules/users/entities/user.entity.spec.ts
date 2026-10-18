import { instanceToPlain } from 'class-transformer';
import { User } from './user.entity';

describe('User entity serialization', () => {
  it('never serializes the password hash', () => {
    const user = Object.assign(new User(), {
      id: 'u-1',
      email: 'a@b.co',
      name: 'Ada',
      password: '$2b$10$hash',
    });

    const plain = instanceToPlain(user);

    expect(plain).toMatchObject({ id: 'u-1', email: 'a@b.co', name: 'Ada' });
    expect(plain).not.toHaveProperty('password');
  });
});
