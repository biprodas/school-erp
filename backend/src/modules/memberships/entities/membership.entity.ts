import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { MembershipRole } from '../enums/membership-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

/**
 * Links a global {@link User} to an {@link Organization}. Holds everything
 * that is per-school about a user: their platform-level role (owner/admin/
 * member), their school-admin flag (bypasses tenant RBAC) and their status
 * inside that school. Org-scoped: protected by row-level security on `org_id`.
 */
@Entity('memberships', { schema: 'public' })
@Index('uq_memberships_org_user', ['orgId', 'userId'], { unique: true })
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @ManyToOne(() => Organization, (organization) => organization.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({
    type: 'enum',
    enum: MembershipRole,
    default: MembershipRole.MEMBER,
  })
  role: MembershipRole;

  /** School admin: bypasses tenant RBAC permission checks inside this org. */
  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.ACTIVE,
  })
  status: MembershipStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
