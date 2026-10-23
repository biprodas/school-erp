import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { EncryptedColumn } from '~/shared/crypto/field-encryption';
import { Student } from './student.entity';

/**
 * A student's health profile (PRD 6.6). The text fields are encrypted at
 * rest (`EncryptedColumn`); reading them needs `student_medical:read` and
 * is audited.
 */
@Entity('student_medical_records')
@Index('uq_student_medical_record', ['orgId', 'studentId'], { unique: true })
export class StudentMedicalRecord extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @OneToOne(() => Student, (student) => student.medicalRecord, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({
    name: 'height_cm',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  heightCm: number | null;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  weightKg: number | null;

  @Column({
    name: 'allergies',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  allergies: string | null;

  @Column({
    name: 'medical_conditions',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  medicalConditions: string | null;

  @Column({
    name: 'medications',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  medications: string | null;

  @Column({
    name: 'vaccinations',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  vaccinations: string | null;

  @Column({
    name: 'disabilities',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  disabilities: string | null;

  @Column({
    name: 'doctor_name',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  doctorName: string | null;

  @Column({
    name: 'doctor_phone',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  doctorPhone: string | null;

  @Column({
    name: 'insurance_info',
    type: 'text',
    nullable: true,
    transformer: EncryptedColumn,
  })
  insuranceInfo: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
