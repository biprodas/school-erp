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

/** A subject (typically an elective) chosen by an enrolled student. */
@Entity('student_subjects')
@Index('uq_student_subject', ['orgId', 'studentEnrollmentId', 'subjectId'], {
  unique: true,
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
