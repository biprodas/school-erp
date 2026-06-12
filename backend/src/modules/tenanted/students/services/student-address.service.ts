import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentAddressDto } from '../dto/create-student-address.dto';
import { UpdateStudentAddressDto } from '../dto/update-student-address.dto';
import { StudentAddress } from '../entities/student-address.entity';
import { StudentAddressRepository } from '../repositories/student-address.repository';
import { StudentService } from './student.service';

@Injectable()
export class StudentAddressService {
  constructor(
    private readonly addressRepo: StudentAddressRepository,
    private readonly studentService: StudentService,
  ) {}

  async listForStudent(studentId: string): Promise<StudentAddress[]> {
    await this.studentService.findById(studentId);
    return this.addressRepo.findByStudent(studentId);
  }

  async create(
    studentId: string,
    dto: CreateStudentAddressDto,
  ): Promise<StudentAddress> {
    await this.studentService.findById(studentId);

    const existing = await this.addressRepo.findByType(
      studentId,
      dto.addressType,
    );
    if (existing) {
      throw new ConflictException(
        `Student already has a "${dto.addressType}" address`,
      );
    }

    return this.addressRepo.saveNew({
      studentId,
      addressType: dto.addressType,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2 ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      state: dto.state ?? null,
      postalCode: dto.postalCode ?? null,
      country: dto.country ?? null,
    });
  }

  async update(
    studentId: string,
    addressId: string,
    dto: UpdateStudentAddressDto,
  ): Promise<StudentAddress> {
    const address = await this.getOrFail(studentId, addressId);

    if (dto.addressType && dto.addressType !== address.addressType) {
      const existing = await this.addressRepo.findByType(
        studentId,
        dto.addressType,
      );
      if (existing && existing.id !== addressId) {
        throw new ConflictException(
          `Student already has a "${dto.addressType}" address`,
        );
      }
    }

    Object.assign(address, dto);
    return this.addressRepo.save(address);
  }

  async remove(studentId: string, addressId: string): Promise<void> {
    await this.getOrFail(studentId, addressId);
    await this.addressRepo.deleteById(addressId);
  }

  private async getOrFail(
    studentId: string,
    addressId: string,
  ): Promise<StudentAddress> {
    const address = await this.addressRepo.findByIdOrFail(addressId);
    if (address.studentId !== studentId) {
      throw new NotFoundException(
        `Address "${addressId}" not found for student "${studentId}"`,
      );
    }
    return address;
  }
}
