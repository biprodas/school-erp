import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { RoleService } from '~/modules/rbac/services/role.service';
import { STUDENT_ROLE_NAME } from '~/modules/rbac/system-roles.seed';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { CreateStudentDto } from '../dto/create-student.dto';
import { FilterStudentDto } from '../dto/filter-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { Student } from '../entities/student.entity';
import { StudentStatus } from '../enums/student-status.enum';
import { StudentRepository } from '../repositories/student.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Paginated } from '~/common/dto/paginated.dto';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly userService: OrgUserService,
    private readonly roleService: RoleService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(filter: FilterStudentDto): Promise<Paginated<Student>> {
    const where: FindOptionsWhere<Student> = {};
    if (filter.id) where.id = filter.id;
    if (filter.admissionNumber) where.admissionNumber = filter.admissionNumber;
    if (filter.firstName) where.firstName = filter.firstName;
    if (filter.lastName) where.lastName = filter.lastName;
    if (filter.status) where.status = filter.status;
    if (filter.userId) where.userId = filter.userId;
    return this.studentRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Student> {
    return this.studentRepo.findByIdOrFail(id);
  }

  create(dto: CreateStudentDto): Promise<Student> {
    return this.ds.runInTransaction(async () => {
      if (dto.userId && dto.createUser) {
        throw new BadRequestException(
          'Provide either userId or createUser, not both',
        );
      }

      const existingByAdmission = await this.studentRepo.findByAdmissionNumber(
        dto.admissionNumber,
      );
      if (existingByAdmission) {
        throw new ConflictException('Admission number already in use');
      }

      let userId: string | null = null;

      if (dto.userId) {
        await this.userService.findById(dto.userId);
        const linked = await this.studentRepo.findByUserId(dto.userId);
        if (linked) {
          throw new ConflictException(
            'User is already linked to another student',
          );
        }
        userId = dto.userId;
      } else if (dto.createUser) {
        const studentRole =
          await this.roleService.findSystemRole(STUDENT_ROLE_NAME);
        const newUser = await this.userService.create({
          name: [dto.firstName, dto.lastName].filter(Boolean).join(' '),
          email: dto.createUser.email,
          password: dto.createUser.password,
          roleIds: [studentRole.id],
        });
        userId = newUser.id;
      }

      const student = await this.studentRepo.saveNew({
        admissionNumber: dto.admissionNumber,
        firstName: dto.firstName,
        middleName: dto.middleName ?? null,
        lastName: dto.lastName,
        dob: dto.dob ?? null,
        gender: dto.gender ?? null,
        religion: dto.religion ?? null,
        nationality: dto.nationality ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        photoUrl: dto.photoUrl ?? null,
        address: dto.address ?? null,
        admissionDate: dto.admissionDate ?? null,
        admissionType: dto.admissionType ?? null,
        status: dto.status ?? StudentStatus.ACTIVE,
        userId,
      });

      return this.findById(student.id);
    });
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findById(id);

    if (
      dto.admissionNumber &&
      dto.admissionNumber !== student.admissionNumber
    ) {
      const conflict = await this.studentRepo.findByAdmissionNumber(
        dto.admissionNumber,
      );
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Admission number already in use');
      }
    }

    if (dto.userId && dto.userId !== student.userId) {
      await this.userService.findById(dto.userId);
      const linked = await this.studentRepo.findByUserId(dto.userId);
      if (linked && linked.id !== id) {
        throw new ConflictException(
          'User is already linked to another student',
        );
      }
    }

    Object.assign(student, dto);
    await this.studentRepo.save(student);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.studentRepo.deleteById(id);
  }
}
