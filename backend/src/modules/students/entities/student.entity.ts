import {
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { User } from '~/modules/users/entities/user.entity';
import { StudentGuardian } from '~/modules/guardians/entities/student-guardian.entity';
import { AdmissionType } from '../enums/admission-type.enum';
import { StudentGender } from '../enums/student-gender.enum';
import { StudentStatus } from '../enums/student-status.enum';
import { StudentAddress } from './student-address.entity';
import { StudentDocument } from './student-document.entity';
import { StudentEmergencyContact } from './student-emergency-contact.entity';
import { StudentMedicalRecord } from './student-medical-record.entity';
import { StudentNote } from './student-note.entity';

@Entity('students')
// Partial: a soft-deleted student doesn't block reusing the number.
@Index('uq_students_org_admission_number', ['orgId', 'admissionNumber'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Student extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'admission_number',
    type: 'varchar',
    length: 60,
  })
  admissionNumber: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'middle_name', type: 'varchar', nullable: true })
  middleName: string | null;

  @Column({ name: 'last_name' })
  lastName: string;

  // virtual column
  fullName: string;

  @Column({ type: 'date', nullable: true })
  dob: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gender: StudentGender | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  religion: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'admission_date', type: 'date', nullable: true })
  admissionDate: string | null;

  @Column({
    name: 'admission_type',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  admissionType: AdmissionType | null;

  @Column({ type: 'varchar', default: StudentStatus.ACTIVE })
  status: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @OneToMany(() => StudentGuardian, (link) => link.student)
  guardians: StudentGuardian[];

  @OneToMany(() => StudentAddress, (address) => address.student)
  addresses: StudentAddress[];

  @OneToMany(() => StudentDocument, (document) => document.student)
  documents: StudentDocument[];

  @OneToMany(() => StudentEmergencyContact, (contact) => contact.student)
  emergencyContacts: StudentEmergencyContact[];

  @OneToMany(() => StudentNote, (note) => note.student)
  notes: StudentNote[];

  @OneToOne(() => StudentMedicalRecord, (record) => record.student)
  medicalRecord: StudentMedicalRecord | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  @AfterLoad()
  @BeforeInsert()
  @BeforeUpdate()
  syncFullName(): void {
    const parts = [this.firstName, this.middleName, this.lastName].filter(
      (p) => p != null && String(p).trim() !== '',
    );
    this.fullName = parts.join(' ');
  }
}
