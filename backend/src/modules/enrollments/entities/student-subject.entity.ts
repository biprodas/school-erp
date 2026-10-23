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
import { Subject } from '~/modules/subjects/entities/subject.entity';
import { StudentEnrollment } from './student-enrollment.entity';

/** A subject (optional, 4th or elective) chosen by an enrolled student. */
@Entity('student_subjects')
@Index('uq_student_subject', ['orgId', 'studentEnrollmentId', 'subjectId'], {
  unique: true,
})
// At most one 4th subject per enrollment.
@Index('uq_student_subjects_fourth', ['orgId', 'studentEnrollmentId'], {
  unique: true,
  where: '"is_fourth_subject"',
})
export class StudentSubject extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_enrollment_id', type: 'uuid' })
  studentEnrollmentId: string;

  @ManyToOne(() => StudentEnrollment, (e) => e.subjects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_enrollment_id' })
  enrollment: StudentEnrollment;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  /** Counted as the BD 4th subject (only above GPA 2.0, in M5). */
  @Column({ name: 'is_fourth_subject', type: 'boolean', default: false })
  isFourthSubject: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
