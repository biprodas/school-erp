import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

/**
 * Something that happened in a school, written in the same transaction as
 * the change (an outbox): later jobs act on it, such as the Phase 1b
 * absentee alerts reading `attendance.submitted`. Nothing reads them yet.
 */
@Entity('domain_events')
@Index('idx_domain_events_pending', ['orgId', 'type', 'occurredAt'], {
  where: `"processed_at" IS NULL`,
})
export class DomainEvent extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `<area>.<event>`, from `DOMAIN_EVENTS`. */
  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  /** Set by the job that handled it. */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
