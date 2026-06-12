import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Student } from './student.entity';

@Entity('student_emergency_contacts')
@Index('idx_student_emergency_contact_student', ['studentId'])
export class StudentEmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.emergencyContacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  relation: string | null;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({
    name: 'alternate_phone',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  alternatePhone: string | null;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
