import { Expose } from 'class-transformer';
import {
  AfterInsert,
  AfterLoad,
  AfterRemove,
  AfterUpdate,
  BeforeInsert,
  BeforeUpdate,
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
import { Membership } from 'src/modules/platform/memberships/entities/membership.entity';

@Entity('users', { schema: 'public' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  /** Never returned by default queries — use { select: [..., 'password'] } explicitly */
  @Column({ select: false })
  password: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  /** Join of first + last name — computed, not stored */
  fullName: string;

  // for testing: will be removed later
  @Expose()
  get name(): string {
    const first = this.firstName?.trim() ?? '';
    const last = this.lastName?.trim() ?? '';
    return [first, last].filter(Boolean).join(' ');
  }

  @Column({
    type: 'enum',
    enum: PlatformRole,
    default: PlatformRole.USER,
    name: 'role',
  })
  role: PlatformRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    name: 'status',
  })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date

  @OneToMany(() => Membership, (membership) => membership.user)
  memberships: Membership[];

  @AfterLoad()
  @BeforeInsert()
  @BeforeUpdate()
  syncFullName(): void {
    const parts = [this.firstName, this.lastName].filter(
      (p) => p != null && String(p).trim() !== '',
    );
    this.fullName = parts.join(' ');
  }

  @AfterInsert()
  logInsert() {
    console.log(`User Inserted #ID: ${this.id}`)
  }

  @AfterUpdate()
  logUpdate() {
    console.log(`User Updated #ID: ${this.id}`)
  }

  @AfterRemove()
  logRemove() {
    console.log(`User Removed`)
  }
}
