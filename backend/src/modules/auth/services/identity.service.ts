import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '~/modules/users/entities/user.entity';
import {
  IdentityProvider,
  UserIdentity,
} from '../entities/user-identity.entity';

/** A linked identity as `GET /auth/me` shows it. */
export interface IdentityView {
  provider: IdentityProvider;
  email: string | null;
  linkedAt: Date;
  lastUsedAt: Date | null;
}

/**
 * External identities linked to global accounts (Google sign-in). Identity
 * data, so it uses the root connection like sessions and credentials.
 */
@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async list(userId: string): Promise<IdentityView[]> {
    const rows = await this.identities.find({
      where: { userId },
      order: { linkedAt: 'ASC' },
    });
    return rows.map((r) => ({
      provider: r.provider,
      email: r.email,
      linkedAt: r.linkedAt,
      lastUsedAt: r.lastUsedAt,
    }));
  }

  findBySubject(
    provider: IdentityProvider,
    subject: string,
  ): Promise<UserIdentity | null> {
    return this.identities.findOne({ where: { provider, subject } });
  }

  /**
   * Links `subject` to the account. Refused when that identity belongs to
   * another account (`IDENTITY_IN_USE`) or the account already has a
   * different one of this provider (`IDENTITY_ALREADY_LINKED`).
   */
  async link(
    userId: string,
    provider: IdentityProvider,
    subject: string,
    email: string | null,
  ): Promise<UserIdentity> {
    const bySubject = await this.findBySubject(provider, subject);
    if (bySubject) {
      if (bySubject.userId !== userId) {
        throw new ConflictException({
          message: 'This account is already linked to another user',
          code: 'IDENTITY_IN_USE',
        });
      }
      return bySubject;
    }
    if (await this.identities.exists({ where: { userId, provider } })) {
      throw new ConflictException({
        message: 'Another account of this provider is already linked',
        code: 'IDENTITY_ALREADY_LINKED',
      });
    }
    return this.identities.save(
      this.identities.create({
        userId,
        provider,
        subject,
        email,
        lastUsedAt: new Date(),
      }),
    );
  }

  async touch(id: string): Promise<void> {
    await this.identities.update(id, { lastUsedAt: new Date() });
  }

  /**
   * Unlinks the provider. Refused (409 `PASSWORD_REQUIRED`) while the
   * account has no password of its own, so nobody loses their only way in.
   */
  async unlink(userId: string, provider: IdentityProvider): Promise<void> {
    const identity = await this.identities.findOne({
      where: { userId, provider },
    });
    if (!identity) {
      throw new NotFoundException({
        message: 'No linked account',
        code: 'IDENTITY_NOT_LINKED',
      });
    }
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, passwordSet: true },
    });
    if (!user?.passwordSet) {
      throw new ConflictException({
        message: 'Set a password before unlinking, so you can still sign in',
        code: 'PASSWORD_REQUIRED',
      });
    }
    await this.identities.delete(identity.id);
  }
}
