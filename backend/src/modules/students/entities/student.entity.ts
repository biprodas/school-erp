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
import { StoredFile } from '~/modules/files/entities/stored-file.entity';
import { StudentGuardian } from '~/modules/guardians/entities/student-guardian.entity';
import { AdmissionType } from '../enums/admission-type.enum';
import { BloodGroup } from '../enums/blood-group.enum';
import { StudentGender } from '../enums/student-gender.enum';
import { StudentStatus } from '../enums/student-status.enum';
import { StudentAddress } from './student-address.entity';
import { StudentDocument } from './student-document.entity';
import { StudentEmergencyContact } from './student-emergency-contact.entity';
import { StudentMedicalRecord } from './student-medical-record.entity';
import { StudentNote } from './student-note.entity';

/**
 * A student (PRD 6.6). `admission_number` is the student ID, generated from
 * the school's `numbering.studentId` pattern. Status changes go through
 * `POST /students/:id/status`; enrollment per session lives in
 * `student_enrollments`.
 */
@Entity('students')
// Partial: a soft-deleted student doesn't block reusing the number.
@Index('uq_students_org_admission_number', ['orgId', 'admissionNumber'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('uq_students_org_rfid', ['orgId', 'rfidCardNo'], {
  unique: true,
  where: '"rfid_card_no" IS NOT NULL AND "deleted_at" IS NULL',
})
// Trigram name search (pg_trgm), created by migration and the dev
// bootstrap with the expressions in `student-search.ts`; sync leaves them.
@Index('idx_students_name_trgm', { synchronize: false })
@Index('idx_students_name_bn_trgm', { synchronize: false })
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

  /** Full name in Bangla. */
  @Column({ name: 'name_bn', type: 'varchar', length: 160, nullable: true })
  nameBn: string | null;

  /** Birth registration number (17 digits). */
  @Column({
    name: 'birth_reg_no',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  birthRegNo: string | null;

  @Column({ name: 'blood_group', type: 'varchar', length: 4, nullable: true })
  bloodGroup: BloodGroup | null;

  @Column({
    name: 'previous_school',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  previousSchool: string | null;

  /** ID card RFID tag bound to the student. */
  @Column({ name: 'rfid_card_no', type: 'varchar', length: 40, nullable: true })
  rfidCardNo: string | null;

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

  /** Normalized (`+8801…`); search matches it exactly. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ name: 'photo_file_id', type: 'uuid', nullable: true })
  photoFileId: string | null;

  @ManyToOne(() => StoredFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'photo_file_id' })
  photoFile?: StoredFile | null;

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
  status: StudentStatus;

  /** The portal login, created when the student's class qualifies. */
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
