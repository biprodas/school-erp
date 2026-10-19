import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

/**
 * Next value of one counter, e.g. `receipt` for scope `2026`. Rows are
 * created on first use and only ever incremented inside the caller's
 * transaction (see NumberingService).
 */
@Entity('numbering_sequences')
@Index('uq_numbering_sequences_key', ['orgId', 'key', 'scope'], {
  unique: true,
})
export class NumberingSequence extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** What is numbered: `student_id`, `receipt`, `invoice`, … */
  @Column({ type: 'varchar', length: 40 })
  key: string;

  /** Restarts the counter, e.g. a year or a class; '' for "never". */
  @Column({ type: 'varchar', length: 60, default: '' })
  scope: string;

  @Column({ name: 'next_value', type: 'bigint', default: 1 })
  nextValue: string;
}
