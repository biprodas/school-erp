import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Student } from '~/modules/students/entities/student.entity';
import { GuardianRelation } from '../enums/guardian-relation.enum';
import { Guardian } from './guardian.entity';

@Entity('student_guardians')
@Index('uq_student_guardian', ['orgId', 'studentId', 'guardianId'], {
  unique: true,
})
// At most one primary guardian per student.
@Index('uq_student_guardians_org_primary', ['orgId', 'studentId'], {
  unique: true,
  where: '"is_primary"',
})
export class StudentGuardian extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'guardian_id', type: 'uuid' })
  guardianId: string;

  @ManyToOne(() => Guardian, (guardian) => guardian.links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guardian_id' })
  guardian: Guardian;

  @Column({ type: 'varchar', length: 16 })
  relation: GuardianRelation;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'is_emergency', type: 'boolean', default: false })
  isEmergency: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
