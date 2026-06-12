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
import { Student } from './student.entity';

@Entity('student_medical_records')
@Index('uq_student_medical_record', ['studentId'], { unique: true })
export class StudentMedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @OneToOne(() => Student, (student) => student.medicalRecord, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'blood_group', type: 'varchar', length: 8, nullable: true })
  bloodGroup: string | null;

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

  @Column({ type: 'text', nullable: true })
  allergies: string | null;

  @Column({ name: 'medical_conditions', type: 'text', nullable: true })
  medicalConditions: string | null;

  @Column({ type: 'text', nullable: true })
  disabilities: string | null;

  @Column({ name: 'doctor_name', type: 'varchar', length: 160, nullable: true })
  doctorName: string | null;

  @Column({ name: 'doctor_phone', type: 'varchar', length: 40, nullable: true })
  doctorPhone: string | null;

  @Column({ name: 'insurance_info', type: 'text', nullable: true })
  insuranceInfo: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
