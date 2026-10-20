import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import type { OrgSettingsValues } from '../settings.types';

type Stored<K extends keyof OrgSettingsValues> = Partial<
  OrgSettingsValues[K]
> | null;

/**
 * One row per school, created with the organization (`OrgSettingsSeeder`).
 * Each section is a jsonb column holding only what the school changed; null
 * means "all defaults".
 * Read through `SettingsService`, which completes it with the defaults.
 */
@Entity('org_settings')
@Index('uq_org_settings_org', ['orgId'], { unique: true })
export class OrgSettings extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', nullable: true })
  profile: Stored<'profile'>;

  @Column({ type: 'jsonb', nullable: true })
  locale: Stored<'locale'>;

  @Column({ type: 'jsonb', nullable: true })
  numbering: Stored<'numbering'>;

  @Column({ type: 'jsonb', nullable: true })
  portal: Stored<'portal'>;

  @Column({ type: 'jsonb', nullable: true })
  results: Stored<'results'>;

  @Column({ type: 'jsonb', nullable: true })
  attendance: Stored<'attendance'>;

  @Column({ type: 'jsonb', nullable: true })
  fees: Stored<'fees'>;

  @Column({ type: 'jsonb', nullable: true })
  notifications: Stored<'notifications'>;

  @Column({ type: 'jsonb', nullable: true })
  security: Stored<'security'>;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
