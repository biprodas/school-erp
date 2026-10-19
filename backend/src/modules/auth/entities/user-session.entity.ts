import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { User } from '~/modules/users/entities/user.entity';

/**
 * One refresh token. A sign-in starts a family; every refresh revokes the
 * current row and adds the next one to the same family. Presenting a revoked
 * token means it was stolen or replayed, so the whole family is revoked.
 * Access tokens carry the family id as `sid`, so revoking a family also ends
 * its access tokens (within the strategies' cache window).
 *
 * `orgId` is the school the session belongs to (null for the platform); a
 * session is only refreshable there.
 */
@Entity('user_sessions')
@Index('idx_user_sessions_family', ['familyId'])
@Index('idx_user_sessions_user', ['userId', 'orgId'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org?: Organization;

  /** sha256 of the refresh token; the raw token is never stored. */
  @Index('uq_user_sessions_refresh_hash', { unique: true })
  @Column({ name: 'refresh_hash', type: 'char', length: 64 })
  refreshHash: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** When the family was last refreshed; drives the idle timeout. */
  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
