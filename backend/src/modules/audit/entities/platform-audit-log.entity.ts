import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditActorType } from '../enums/audit-actor-type.enum';

/**
 * The platform's audit log: platform-admin actions (schools, plans,
 * memberships) and sign-in events of the platform realm, which happen before
 * any school is involved. Same shape as `audit_logs`; `org_id` names the
 * school concerned, if any, without a foreign key so the row survives the
 * school's deletion. Root connection only: no RLS, no app-role grant.
 */
@Entity('platform_audit_logs')
@Index('idx_platform_audit_logs_created', ['createdAt'])
@Index('idx_platform_audit_logs_org', ['orgId', 'createdAt'])
@Index('idx_platform_audit_logs_actor', ['actorUserId', 'createdAt'])
@Index('idx_platform_audit_logs_action', ['action', 'createdAt'])
export class PlatformAuditLog {
  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for anonymous events (a failed sign-in for an unknown account). */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 16 })
  actorType: AuditActorType;

  /** One of `AUDIT_ACTIONS`, e.g. `role.updated`. */
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  /** Platform user acting as `actorUserId` (consent-based support, 1b). */
  @Column({ name: 'impersonator_id', type: 'uuid', nullable: true })
  impersonatorId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
