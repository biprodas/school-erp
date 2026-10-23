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
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { Student } from '~/modules/students/entities/student.entity';
import { CertificateStatus, CertificateType } from '../enums/certificate.enum';

/** What the certificate says, frozen when it was issued. */
export interface CertificateData {
  studentName: string;
  studentNameBn: string | null;
  admissionNumber: string;
  dob: string | null;
  fatherName: string | null;
  motherName: string | null;
  className: string | null;
  sectionName: string | null;
  rollNo: string | null;
  sessionName: string | null;
  schoolName: string;
  schoolNameBn: string | null;
  /** Where the QR code points. */
  verifyUrl: string;
  /** Free text the issuer adds (reason for leaving, conduct, …). */
  remarks: string | null;
  conduct: string | null;
  leavingReason: string | null;
}

/**
 * A TC, testimonial, character or study certificate (PRD 6.6). Its serial
 * comes from `numbering.certificate`; the QR code holds `verify_token`,
 * which `GET /public/certificates/verify/:token` answers from any host.
 */
@Entity('certificates')
@Index('uq_certificates_org_serial', ['orgId', 'serial'], { unique: true })
@Index('uq_certificates_verify_token', ['verifyToken'], { unique: true })
@Index('idx_certificates_student', ['orgId', 'studentId'])
export class Certificate extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: Student;

  @Column({ type: 'varchar', length: 16 })
  type: CertificateType;

  @Column({ type: 'varchar', length: 60 })
  serial: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'issued_by', type: 'uuid', nullable: true })
  issuedBy: string | null;

  @Column({ type: 'jsonb' })
  data: CertificateData;

  @Column({ type: 'varchar', length: 16, default: CertificateStatus.VALID })
  status: CertificateStatus;

  @Column({ name: 'revoke_reason', type: 'text', nullable: true })
  revokeReason: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  /** Random and unguessable; the public lookup key in the QR code. */
  @Column({ name: 'verify_token', type: 'varchar', length: 64 })
  verifyToken: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
