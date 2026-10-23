import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { EncryptedColumn } from '~/shared/crypto/field-encryption';

/** `bigint` minor units (poisha) as a JS number. */
const money = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
import { User } from '~/modules/users/entities/user.entity';
import { StudentGuardian } from './student-guardian.entity';

/**
 * A parent or guardian (PRD 6.6); one can be linked to several students.
 * The phone (normalized) is unique in the school and is how imports match
 * an existing guardian. Every guardian gets a portal login (`user_id`).
 */
@Entity('guardians')
@Index('uq_guardians_org_phone', ['orgId', 'phone'], {
  unique: true,
  where: '"phone" IS NOT NULL AND "deleted_at" IS NULL',
})
export class Guardian extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'name_bn', type: 'varchar', length: 160, nullable: true })
  nameBn: string | null;

  /** Normalized (`+8801…`). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  occupation: string | null;

  /** Monthly income in minor units (poisha), as the school records it. */
  @Column({ type: 'bigint', nullable: true, transformer: money })
  income: number | null;

  /** National ID, encrypted at rest. */
  @Column({ type: 'text', nullable: true, transformer: EncryptedColumn })
  nid: string | null;

  /** The portal login (guardian role), made with the guardian. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @OneToMany(() => StudentGuardian, (link) => link.guardian)
  links: StudentGuardian[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
