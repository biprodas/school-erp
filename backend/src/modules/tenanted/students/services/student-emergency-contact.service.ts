import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudentEmergencyContactDto } from '../dto/create-student-emergency-contact.dto';
import { UpdateStudentEmergencyContactDto } from '../dto/update-student-emergency-contact.dto';
import { StudentEmergencyContact } from '../entities/student-emergency-contact.entity';
import { StudentEmergencyContactRepository } from '../repositories/student-emergency-contact.repository';
import { StudentService } from './student.service';

@Injectable()
export class StudentEmergencyContactService {
  constructor(
    private readonly contactRepo: StudentEmergencyContactRepository,
    private readonly studentService: StudentService,
  ) {}

  async listForStudent(studentId: string): Promise<StudentEmergencyContact[]> {
    await this.studentService.findById(studentId);
    return this.contactRepo.findByStudent(studentId);
  }

  async create(
    studentId: string,
    dto: CreateStudentEmergencyContactDto,
  ): Promise<StudentEmergencyContact> {
    await this.studentService.findById(studentId);

    return this.contactRepo.saveNew({
      studentId,
      name: dto.name,
      relation: dto.relation ?? null,
      phone: dto.phone,
      alternatePhone: dto.alternatePhone ?? null,
      priority: dto.priority ?? 1,
    });
  }

  async update(
    studentId: string,
    contactId: string,
    dto: UpdateStudentEmergencyContactDto,
  ): Promise<StudentEmergencyContact> {
    const contact = await this.getOrFail(studentId, contactId);
    Object.assign(contact, dto);
    return this.contactRepo.save(contact);
  }

  async remove(studentId: string, contactId: string): Promise<void> {
    await this.getOrFail(studentId, contactId);
    await this.contactRepo.deleteById(contactId);
  }

  private async getOrFail(
    studentId: string,
    contactId: string,
  ): Promise<StudentEmergencyContact> {
    const contact = await this.contactRepo.findByIdOrFail(contactId);
    if (contact.studentId !== studentId) {
      throw new NotFoundException(
        `Emergency contact "${contactId}" not found for student "${studentId}"`,
      );
    }
    return contact;
  }
}
