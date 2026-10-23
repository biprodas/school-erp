import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '~/modules/users/entities/user.entity';

/** External sign-in providers an account can link. */
export enum IdentityProvider {
  GOOGLE = 'google',
}

/**
 * An external identity linked to a global account (Google sign-in,
 * doc/domains-and-routing.md 5a). Only the provider's subject id and email
 * are kept, never its tokens. Identity data: root connection only, no RLS,
 * no app-role grant.
 */
@Entity('user_identities', { schema: 'public' })
@Index('uq_user_identities_provider_subject', ['provider', 'subject'], {
  unique: true,
})
// One identity per provider and account.
@Index('uq_user_identities_user_provider', ['userId', 'provider'], {
  unique: true,
})
export class UserIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 32 })
  provider: IdentityProvider;

  /** The provider's stable user id (`sub`). */
  @Column({ type: 'varchar', length: 255 })
  subject: string;

  /** The provider's email when linked (informational). */
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'linked_at', type: 'timestamptz', default: () => 'now()' })
  linkedAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
