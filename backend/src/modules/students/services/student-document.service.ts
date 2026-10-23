import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { CreateStudentDocumentDto } from '../dto/create-student-document.dto';
import { UpdateStudentDocumentDto } from '../dto/update-student-document.dto';
import { VerifyStudentDocumentDto } from '../dto/verify-student-document.dto';
import { StudentDocument } from '../entities/student-document.entity';
import { DocumentVerification } from '../enums/document-verification.enum';
import { StudentDocumentRepository } from '../repositories/student-document.repository';
import { StudentService } from './student.service';

/**
 * A student's documents (birth certificate, previous TC, …; PRD 6.6): an
 * uploaded file with type, dates and a verification status.
 */
@Injectable()
export class StudentDocumentService {
  private readonly logger = new Logger(StudentDocumentService.name);

  constructor(
    private readonly documentRepo: StudentDocumentRepository,
    private readonly studentService: StudentService,
    private readonly files: FileService,
    private readonly context: RequestContext,
  ) {}

  async listForStudent(studentId: string): Promise<StudentDocument[]> {
    await this.studentService.findById(studentId);
    return this.documentRepo.findByStudent(studentId);
  }

  async create(
    studentId: string,
    dto: CreateStudentDocumentDto,
    file: IncomingFile,
  ): Promise<StudentDocument> {
    await this.studentService.findById(studentId);
    const stored = await this.files.upload(file, 'student_document');
    try {
      return await this.documentRepo.saveNew({
        studentId,
        documentType: dto.documentType,
        title: dto.title ?? null,
        fileId: stored.id,
        issueDate: dto.issueDate ?? null,
        expiryDate: dto.expiryDate ?? null,
        verificationStatus: DocumentVerification.PENDING,
        createdBy: this.context.current().userId,
      });
    } catch (err) {
      await this.removeFileQuietly(stored.id);
      throw err;
    }
  }

  async update(
    studentId: string,
    documentId: string,
    dto: UpdateStudentDocumentDto,
  ): Promise<StudentDocument> {
    const document = await this.getOrFail(studentId, documentId);
    Object.assign(document, dto);
    return this.documentRepo.save(document);
  }

  /** Marks the document checked (or rejected, with a note). */
  async verify(
    studentId: string,
    documentId: string,
    dto: VerifyStudentDocumentDto,
  ): Promise<StudentDocument> {
    const document = await this.getOrFail(studentId, documentId);
    Object.assign(document, {
      verificationStatus: dto.status,
      verificationNote: dto.note ?? null,
      verifiedBy: this.context.current().userId,
      verifiedAt: new Date(),
    });
    return this.documentRepo.save(document);
  }

  /** A short-lived link to the file. */
  async downloadUrl(
    studentId: string,
    documentId: string,
  ): Promise<{ url: string }> {
    const document = await this.getOrFail(studentId, documentId);
    if (!document.fileId) {
      throw new NotFoundException({
        message: 'This document has no stored file',
        code: 'NO_FILE',
      });
    }
    return { url: await this.files.getDownloadUrl(document.fileId) };
  }

  /** Soft-deletes the record (history); the file stays for it. */
  async remove(studentId: string, documentId: string): Promise<void> {
    await this.getOrFail(studentId, documentId);
    await this.documentRepo.deleteById(documentId);
  }

  /** Every document of the student (counts for the 360 view). */
  countForStudent(studentId: string): Promise<number> {
    return this.documentRepo.count({ where: { studentId } });
  }

  private async getOrFail(
    studentId: string,
    documentId: string,
  ): Promise<StudentDocument> {
    const document = await this.documentRepo.findByIdOrFail(documentId);
    if (document.studentId !== studentId) {
      throw new NotFoundException(
        `Document "${documentId}" not found for student "${studentId}"`,
      );
    }
    return document;
  }

  private async removeFileQuietly(fileId: string): Promise<void> {
    await this.files
      .remove(fileId)
      .catch((err: Error) =>
        this.logger.warn(`Could not remove file ${fileId}: ${err.message}`),
      );
  }
}
