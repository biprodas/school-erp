import { Exclude } from 'class-transformer';
import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlatformRole } from '../enums/platform-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { Membership } from '~/modules/memberships/entities/membership.entity';

/**
 * A global account (one login across schools). It is identified by an email,
 * a phone number, or both; each is stored normalized (see
 * `common/identity/identifier.ts`) and unique when present.
 */
@Entity('users', { schema: 'public' })
@Check('chk_users_email_or_phone', `"email" IS NOT NULL OR "phone" IS NOT NULL`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Lower-case; null for phone-only accounts. */
  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  /** E.164 (`+8801712345678`); null for email-only accounts. */
  @Column({ type: 'varchar', length: 16, unique: true, nullable: true })
  phone: string | null;

  /**
   * Never returned by default queries — use { select: [..., 'password'] }
   * explicitly. Also stripped from API responses in case such an entity is
   * ever returned (ClassSerializerInterceptor honours @Exclude).
   */
  @Exclude({ toPlainOnly: true })
  @Column({ select: false })
  password: string;

  /** Optional handle; unique when set (Postgres allows many NULLs). */
  @Column({ type: 'varchar', length: 60, unique: true, nullable: true })
  username: string | null;

  @Column()
  name: string;

  @Column({
    name: 'platform_role',
    type: 'enum',
    enum: PlatformRole,
    default: PlatformRole.USER,
  })
  platformRole: PlatformRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    name: 'status',
  })
  status: UserStatus;

  /** Set when the user confirms their email; null while unverified. */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** Set when the user confirms their phone by SMS OTP (Phase 1b). */
  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  /**
   * The password was set by someone else (invite slip, admin); the user must
   * choose a new one before using anything else.
   */
  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword: boolean;

  /**
   * False for accounts created through Google (their stored password is a
   * random one nobody knows) until the user sets one; unlinking Google
   * needs it, so nobody locks themselves out.
   */
  @Column({ name: 'password_set', type: 'boolean', default: true })
  passwordSet: boolean;

  /** Consecutive failed sign-ins; reset on success or when a lock starts. */
  @Exclude({ toPlainOnly: true })
  @Column({ name: 'failed_login_count', type: 'int', default: 0 })
  failedLoginCount: number;

  /** Sign-in is refused until then (5 failures → 15 minutes). */
  @Exclude({ toPlainOnly: true })
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];
}
