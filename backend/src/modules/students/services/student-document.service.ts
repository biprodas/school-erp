import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudentDocumentDto } from '../dto/create-student-document.dto';
import { UpdateStudentDocumentDto } from '../dto/update-student-document.dto';
import { StudentDocument } from '../entities/student-document.entity';
import { StudentDocumentRepository } from '../repositories/student-document.repository';
import { StudentService } from './student.service';

@Injectable()
export class StudentDocumentService {
  constructor(
    private readonly documentRepo: StudentDocumentRepository,
    private readonly studentService: StudentService,
  ) {}

  async listForStudent(studentId: string): Promise<StudentDocument[]> {
    await this.studentService.findById(studentId);
    return this.documentRepo.findByStudent(studentId);
  }

  async create(
    studentId: string,
    dto: CreateStudentDocumentDto,
    createdBy: string | null,
  ): Promise<StudentDocument> {
    await this.studentService.findById(studentId);

    return this.documentRepo.saveNew({
      studentId,
      documentType: dto.documentType,
      title: dto.title ?? null,
      fileUrl: dto.fileUrl,
      issueDate: dto.issueDate ?? null,
      expiryDate: dto.expiryDate ?? null,
      verified: dto.verified ?? false,
      createdBy,
    });
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

  async remove(studentId: string, documentId: string): Promise<void> {
    await this.getOrFail(studentId, documentId);
    await this.documentRepo.deleteById(documentId);
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
}
