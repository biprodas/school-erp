import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

/** One invoice generation for a period (the scheduler runs once per period). */
@Entity('billing_runs')
@Index('uq_billing_runs_auto', ['orgId', 'period'], {
  unique: true,
  where: `"automatic"`,
})
export class BillingRun extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  /** Started by the billing-day scheduler (else by hand). */
  @Column({ type: 'boolean', default: false })
  automatic: boolean;

  /** Classes it was limited to; empty = all. */
  @Column({
    name: 'class_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  classIds: string[];

  @Column({ name: 'invoices_created', type: 'int', default: 0 })
  invoicesCreated: number;

  @Column({ name: 'lines_created', type: 'int', default: 0 })
  linesCreated: number;

  @Column({ name: 'started_by', type: 'uuid', nullable: true })
  startedBy: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
