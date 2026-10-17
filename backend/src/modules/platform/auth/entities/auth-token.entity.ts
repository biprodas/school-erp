import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';
import { Organization } from 'src/modules/platform/organizations/entities/organization.entity';

/**
 * One-time auth token for a (global) user — email verification, password
 * reset or org activation, distinguished by {@link type}. `orgId` is null for
 * tokens issued by the platform and set for tokens issued inside a school, so
 * each realm only redeems its own. The raw token is never stored, only its
 * sha256 hash. Single-use (`usedAt`) and time-limited (`expiresAt`).
 */
@Entity('auth_tokens', { schema: 'public' })
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Issuing organization; null for platform-issued tokens. */
  @Index()
  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'org_id' })
  organization?: Organization | null;

  @Index('uq_auth_tokens_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 32 })
  type: AuthTokenType;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
