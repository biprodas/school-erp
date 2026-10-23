import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrgScopedEntity } from '~/tenancy/org-scoped.entity';
import { StoredFile } from '~/modules/files/entities/stored-file.entity';
import { DocumentVerification } from '../enums/document-verification.enum';
import { DocumentType } from '../enums/document-type.enum';
import { Student } from './student.entity';

@Entity('student_documents')
@Index('idx_student_document_student', ['studentId'])
export class StudentDocument extends OrgScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, (student) => student.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'document_type', type: 'varchar', length: 32 })
  documentType: DocumentType;

  @Column({ type: 'varchar', length: 160, nullable: true })
  title: string | null;

  /** The uploaded file (null only on rows from before uploads). */
  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId: string | null;

  @ManyToOne(() => StoredFile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id' })
  file?: StoredFile | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 16,
    default: DocumentVerification.PENDING,
  })
  verificationStatus: DocumentVerification;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  /** Why it was rejected, or a note on the check. */
  @Column({ name: 'verification_note', type: 'text', nullable: true })
  verificationNote: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
