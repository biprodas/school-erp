import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { AuditActorType } from '../enums/audit-actor-type.enum';

/**
 * Append-only record of a security-relevant action inside one school:
 * sign-ins, permission and role changes, and later financial records, mark
 * changes, attendance corrections and exports (PRD 6.3, 8.1). The app role
 * may only SELECT and INSERT here, so rows can't be edited or removed from
 * the app. Actor and entity ids are plain columns (no foreign keys), so a row
 * outlives the user or record it mentions; it goes only with its school.
 */
@Entity('audit_logs')
@Index('idx_audit_logs_org_created', ['orgId', 'createdAt'])
@Index('idx_audit_logs_org_entity', ['orgId', 'entityType', 'entityId'])
@Index('idx_audit_logs_org_actor', ['orgId', 'actorUserId', 'createdAt'])
@Index('idx_audit_logs_org_action', ['orgId', 'action', 'createdAt'])
export class AuditLog extends OrgScopedEntity {
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
