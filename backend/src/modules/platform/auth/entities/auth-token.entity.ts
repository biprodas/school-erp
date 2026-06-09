import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTokenType } from '~/common/tokens/auth-token-type.enum';

/**
 * One-time auth token for a platform user — email verification or password
 * reset, distinguished by {@link type}. The raw token is never stored, only its
 * sha256 hash. Single-use (`usedAt`) and time-limited (`expiresAt`).
 */
@Entity('auth_tokens', { schema: 'public' })
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index('uq_platform_auth_tokens_hash', { unique: true })
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
