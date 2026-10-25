import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SEED_USERS } from './data/users.data';

/**
 * Core seed: platform user accounts.
 *
 * Idempotent, keyed by email. A new user is created ACTIVE and verified with
 * the seed password. An existing user gets username, name and platform role
 * synced, and keeps its current password.
 */
export async function seedCore(ds: DataSource): Promise<void> {
  await ds.transaction(async (manager) => {
    const repo = manager.getRepository(User);

    for (const seed of SEED_USERS) {
      const existing = await repo.findOne({
        where: { email: seed.email },
        withDeleted: true,
      });

      if (existing) {
        await repo.update(existing.id, {
          username: seed.username,
          name: seed.name,
          platformRole: seed.role,
        });
        console.log(`  updated  ${seed.email} (${seed.role})`);
        continue;
      }

      await repo.save(
        repo.create({
          email: seed.email,
          username: seed.username,
          name: seed.name,
          password: await bcrypt.hash(seed.password, 10),
          platformRole: seed.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        }),
      );
      console.log(`  created  ${seed.email} (${seed.role})`);
    }
  });
}
