import {
  AfterInsert,
  AfterRemove,
  AfterUpdate,
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
import { Membership } from 'src/modules/memberships/entities/membership.entity';

@Entity('users', { schema: 'public' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  /** Never returned by default queries — use { select: [..., 'password'] } explicitly */
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

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  /** Set when the user confirms their email; null while unverified. */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];

  @AfterInsert()
  logInsert() {
    console.log(`User Inserted #ID: ${this.id}`);
  }

  @AfterUpdate()
  logUpdate() {
    console.log(`User Updated #ID: ${this.id}`);
  }

  @AfterRemove()
  logRemove() {
    console.log(`User Removed`);
  }
}
