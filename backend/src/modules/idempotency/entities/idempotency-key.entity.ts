import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';

/**
 * One `Idempotency-Key` a client sent to an `@Idempotent()` endpoint. While
 * the first request runs, `statusCode` is null; afterwards the response is
 * kept for 24 hours so a retry gets the same answer instead of a second
 * payment or a second attendance submission.
 */
@Entity('idempotency_keys')
@Index('uq_idempotency_keys_org_key', ['orgId', 'key'], { unique: true })
@Index('idx_idempotency_keys_expires_at', ['expiresAt'])
export class IdempotencyKey extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `<userId>:<client key>` (`-` when anonymous): keys are per user. */
  @Column({ type: 'varchar', length: 200 })
  key: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  /** sha256 of method, path and body: the same key must mean the same request. */
  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'jsonb', nullable: true })
  response: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
