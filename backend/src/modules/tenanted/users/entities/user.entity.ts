import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  AfterInsert,
  AfterUpdate,
  AfterRemove,
} from 'typeorm';
import { UserStatus } from '../enums/user-status.enum';
import { UserRole } from '../../rbac/entities/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: UserStatus.ACTIVE })
  status: string;

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  /**
   * Links this tenant user back to the platform user it was provisioned from
   * (e.g. when an admin assigns a tenant owner). Null for self-created users.
   */
  @Column({ name: 'platform_user_id', type: 'uuid', nullable: true })
  platformUserId: string | null;

  /** Set when the user confirms their email; null while unverified. */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

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
