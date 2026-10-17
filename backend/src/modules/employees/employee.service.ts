import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleRepository } from '../rbac/role.repository';
import { OrgUserService } from '../users/services/org-user.service';
import { DepartmentRepository } from '../departments/department.repository';
import { DesignationRepository } from '../designations/designation.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { FilterEmployeeDto } from './dto/filter-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { EmployeeStatus } from './enums/employee-status.enum';
import { EmployeeRepository } from './employee.repository';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly userService: OrgUserService,
    private readonly roleRepo: RoleRepository,
    private readonly departmentRepo: DepartmentRepository,
    private readonly designationRepo: DesignationRepository,
  ) {}

  async findFiltered(filter: FilterEmployeeDto): Promise<Employee[]> {
    const where: Record<string, any> = {};
    if (filter.id) where.id = filter.id;
    if (filter.employeeNumber) where.employeeNumber = filter.employeeNumber;
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.designationId) where.designationId = filter.designationId;
    if (filter.status) where.status = filter.status;
    if (filter.userId) where.userId = filter.userId;
    return this.employeeRepo.findFiltered(where);
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findByIdWithRelations(id);
    if (!employee) {
      throw new NotFoundException(`Employee with id "${id}" not found`);
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    if (dto.userId && dto.createUser) {
      throw new BadRequestException(
        'Provide either userId or createUser, not both',
      );
    }

    const existingByNumber = await this.employeeRepo.findByEmployeeNumber(
      dto.employeeNumber,
    );
    if (existingByNumber) {
      throw new ConflictException('Employee number already in use');
    }

    if (dto.departmentId) {
      await this.departmentRepo.findByIdOrFail(dto.departmentId);
    }
    if (dto.designationId) {
      await this.designationRepo.findByIdOrFail(dto.designationId);
    }

    let userId: string | null = null;

    if (dto.userId) {
      await this.userService.findById(dto.userId);
      const linked = await this.employeeRepo.findByUserId(dto.userId);
      if (linked) {
        throw new ConflictException(
          'User is already linked to another employee',
        );
      }
      userId = dto.userId;
    } else if (dto.createUser) {
      const roleIds = [...new Set(dto.createUser.roleIds)];
      for (const roleId of roleIds) {
        await this.roleRepo.findByIdOrFail(roleId);
      }
      const newUser = await this.userService.create({
        name: [dto.firstName, dto.lastName].filter(Boolean).join(' '),
        email: dto.createUser.email,
        password: dto.createUser.password,
        roleIds,
      });
      userId = newUser.id;
    }

    const employee = await this.employeeRepo.saveNew({
      employeeNumber: dto.employeeNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      gender: dto.gender ?? null,
      dob: dto.dob ?? null,
      address: dto.address ?? null,
      joiningDate: dto.joiningDate ?? null,
      qualification: dto.qualification ?? null,
      status: dto.status ?? EmployeeStatus.ACTIVE,
      departmentId: dto.departmentId ?? null,
      designationId: dto.designationId ?? null,
      userId,
    });

    return this.findById(employee.id);
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findById(id);

    if (dto.employeeNumber && dto.employeeNumber !== employee.employeeNumber) {
      const conflict = await this.employeeRepo.findByEmployeeNumber(
        dto.employeeNumber,
      );
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Employee number already in use');
      }
    }

    if (dto.departmentId && dto.departmentId !== employee.departmentId) {
      await this.departmentRepo.findByIdOrFail(dto.departmentId);
    }
    if (dto.designationId && dto.designationId !== employee.designationId) {
      await this.designationRepo.findByIdOrFail(dto.designationId);
    }

    if (dto.userId && dto.userId !== employee.userId) {
      await this.userService.findById(dto.userId);
      const linked = await this.employeeRepo.findByUserId(dto.userId);
      if (linked && linked.id !== id) {
        throw new ConflictException(
          'User is already linked to another employee',
        );
      }
    }

    Object.assign(employee, dto);
    await this.employeeRepo.save(employee);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.employeeRepo.deleteById(id);
  }
}
