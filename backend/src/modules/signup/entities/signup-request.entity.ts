import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';

/**
 * A self-serve school signup waiting for email verification (PRD 6.2, 7.1).
 * It reserves nothing: the slug is checked again when the link is used, and
 * the school and owner are created only then. Platform table, root
 * connection only. Only the token's hash is stored.
 */
@Entity('signup_requests', { schema: 'public' })
export class SignupRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'school_name', type: 'varchar', length: 100 })
  schoolName: string;

  @Column({ type: 'varchar', length: 32 })
  type: OrganizationType;

  @Column({ type: 'varchar', length: 63 })
  slug: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 100 })
  ownerName: string;

  /** Normalized (lower-case). */
  @Index()
  @Column({ type: 'varchar' })
  email: string;

  /** E.164; verified by SMS OTP from Phase 1b. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string | null;

  /** bcrypt hash; null when Google verified the email (no password). */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @Index('uq_signup_requests_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64, nullable: true })
  tokenHash: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /** The school created from it (no FK: the row outlives a deleted school). */
  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
