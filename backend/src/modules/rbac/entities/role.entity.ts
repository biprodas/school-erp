import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { RoleScope } from '../enums/role-scope.enum';
import { UserRole } from './user-role.entity';

/**
 * A role inside a tenant schema. Seeded system roles (`isSystem = true`)
 * cannot be deleted or renamed, but their permissions may be adjusted.
 * `permissions` holds keys from the code-defined permission catalog; `scope`
 * says whether they cover the whole school or only the holder's assigned
 * sections and subjects.
 */
@Entity('roles')
@Index('uq_roles_org_name', ['orgId', 'name'], { unique: true })
export class Role extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, default: [] })
  permissions: string[];

  @Column({ type: 'enum', enum: RoleScope, default: RoleScope.SCHOOL })
  scope: RoleScope;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];
}
