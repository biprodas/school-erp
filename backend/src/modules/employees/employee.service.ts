import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import {
  InviteService,
  type InviteResult,
} from '~/modules/auth/services/invite.service';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { DepartmentService } from '~/modules/departments/department.service';
import { DesignationService } from '~/modules/designations/designation.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { FilterEmployeeDto } from './dto/filter-employee.dto';
import { InviteEmployeeDto } from './dto/invite-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { EmployeeStatus } from './enums/employee-status.enum';
import { EmployeeRepository } from './employee.repository';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { Paginated } from '~/common/dto/paginated.dto';

/** Counter key in `numbering_sequences` for generated employee numbers. */
export const EMPLOYEE_NUMBER_KEY = 'employee';

/** Generated numbers skipped because someone typed them in by hand. */
const MAX_NUMBER_ATTEMPTS = 20;

/**
 * The staff directory (PRD 6.4): profile, department, designation and the
 * link to the person's school membership, which `invite` creates.
 */
@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly userService: OrgUserService,
    private readonly departmentService: DepartmentService,
    private readonly designationService: DesignationService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly files: FileService,
    private readonly invites: InviteService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  findFiltered(filter: FilterEmployeeDto): Promise<Paginated<Employee>> {
    const where: FindOptionsWhere<Employee> = {};
    if (filter.id) where.id = filter.id;
    if (filter.employeeNumber) where.employeeNumber = filter.employeeNumber;
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.designationId) where.designationId = filter.designationId;
    if (filter.status) where.status = filter.status;
    if (filter.userId) where.userId = filter.userId;
    return this.employeeRepo.findFiltered(where, filter);
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findByIdWithRelations(id);
    if (!employee) {
      throw new NotFoundException(`Employee with id "${id}" not found`);
    }
    return employee;
  }

  /** `GET /employees/:id`: the record plus a signed photo URL. */
  async findOneView(
    id: string,
  ): Promise<Employee & { photoUrl: string | null }> {
    const employee = await this.findById(id);
    const photoUrl = employee.photoFileId
      ? await this.files.getDownloadUrl(employee.photoFileId)
      : null;
    return Object.assign(employee, { photoUrl });
  }

  findByEmployeeNumber(employeeNumber: string): Promise<Employee | null> {
    return this.employeeRepo.findByEmployeeNumber(employeeNumber);
  }

  /** The employee record linked to a user account, if any. */
  findByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepo.findByUserId(userId);
  }

  create(dto: CreateEmployeeDto): Promise<Employee> {
    return this.ds.runInTransaction(async () => {
      if (dto.employeeNumber) {
        await this.assertNumberFree(dto.employeeNumber);
      }
      if (dto.departmentId) {
        await this.departmentService.findById(dto.departmentId);
      }
      if (dto.designationId) {
        await this.designationService.findById(dto.designationId);
      }
      if (dto.userId) await this.assertLinkable(dto.userId);

      const employee = await this.employeeRepo.saveNew({
        employeeNumber: dto.employeeNumber ?? (await this.nextNumber()),
        firstName: dto.firstName,
        lastName: dto.lastName,
        nameBn: dto.nameBn ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        nid: dto.nid ?? null,
        gender: dto.gender ?? null,
        dob: dto.dob ?? null,
        address: dto.address ?? null,
        joiningDate: dto.joiningDate ?? null,
        qualification: dto.qualification ?? null,
        status: dto.status ?? EmployeeStatus.ACTIVE,
        employmentType: dto.employmentType ?? null,
        departmentId: dto.departmentId ?? null,
        designationId: dto.designationId ?? null,
        userId: dto.userId ?? null,
      });

      return this.findById(employee.id);
    });
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findById(id);

    if (dto.employeeNumber && dto.employeeNumber !== employee.employeeNumber) {
      await this.assertNumberFree(dto.employeeNumber, id);
    }
    if (dto.departmentId && dto.departmentId !== employee.departmentId) {
      await this.departmentService.findById(dto.departmentId);
    }
    if (dto.designationId && dto.designationId !== employee.designationId) {
      await this.designationService.findById(dto.designationId);
    }
    if (dto.userId && dto.userId !== employee.userId) {
      await this.assertLinkable(dto.userId, id);
    }

    await this.employeeRepo.updateFields(id, dto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.employeeRepo.deleteById(id);
  }

  /** Stores a new photo; the previous one is removed. */
  async setPhoto(
    id: string,
    file: IncomingFile,
  ): Promise<{ fileId: string; url: string }> {
    const employee = await this.findById(id);
    const stored = await this.files.upload(file, 'employee_photo');
    try {
      await this.employeeRepo.updateFields(id, { photoFileId: stored.id });
    } catch (err) {
      await this.removeFileQuietly(stored.id);
      throw err;
    }
    if (employee.photoFileId)
      await this.removeFileQuietly(employee.photoFileId);
    return {
      fileId: stored.id,
      url: await this.files.getDownloadUrl(stored.id),
    };
  }

  /**
   * Gives the employee a login in this school through the invite flow
   * (PRD 6.3): an activation link to their email, or a printed-slip
   * password when they only have a phone. The role defaults to the
   * designation's; the new membership is linked to the record.
   */
  async invite(id: string, dto: InviteEmployeeDto): Promise<InviteResult> {
    const employee = await this.findById(id);
    if (employee.userId) {
      throw new ConflictException({
        message: 'The employee already has a login in this school',
        code: 'EMPLOYEE_ALREADY_LINKED',
      });
    }
    if (!employee.email && !employee.phone) {
      throw new BadRequestException({
        message: 'Add an email address or a phone number first',
        code: 'IDENTIFIER_REQUIRED',
      });
    }
    const roleIds =
      dto.roleIds ??
      (employee.designation?.defaultRoleId
        ? [employee.designation.defaultRoleId]
        : undefined);
    if (!roleIds?.length) {
      throw new BadRequestException({
        message:
          'Choose a role, or give the designation a default role, before inviting',
        code: 'ROLE_REQUIRED',
      });
    }

    // InviteService commits the membership in its own transaction and
    // sends mail after it; the link follows in a second one.
    const result = await this.invites.invite({
      name: employee.fullName,
      email: employee.email ?? undefined,
      phone: employee.email ? undefined : (employee.phone ?? undefined),
      roleIds,
    });
    await this.ds.runInTransaction(async () => {
      await this.assertLinkable(result.userId, id);
      await this.employeeRepo.updateFields(id, { userId: result.userId });
      await this.audit.record({
        action: AUDIT_ACTIONS.EMPLOYEE_INVITED,
        entityType: 'employee',
        entityId: id,
        after: { userId: result.userId, delivery: result.delivery, roleIds },
      });
    });
    return result;
  }

  /**
   * The next `numbering.employeeId` number, skipping any already typed in
   * by hand. Call inside the insert's transaction.
   */
  private async nextNumber(): Promise<string> {
    const pattern = (await this.settings.getSection('numbering')).employeeId;
    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
      let candidate: string;
      try {
        candidate = await this.numbering.nextFormatted(
          EMPLOYEE_NUMBER_KEY,
          pattern,
        );
      } catch {
        throw new BadRequestException({
          message: 'The employee number pattern can only use dates and {SEQ}',
          code: 'INVALID_NUMBERING_PATTERN',
        });
      }
      if (!(await this.employeeRepo.findByEmployeeNumber(candidate))) {
        return candidate;
      }
    }
    throw new ConflictException({
      message: 'Could not generate a free employee number; enter one',
      code: 'EMPLOYEE_NUMBER_EXHAUSTED',
    });
  }

  private async assertNumberFree(
    employeeNumber: string,
    exceptId?: string,
  ): Promise<void> {
    const existing =
      await this.employeeRepo.findByEmployeeNumber(employeeNumber);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException({
        message: 'Employee number already in use',
        code: 'EMPLOYEE_NUMBER_TAKEN',
      });
    }
  }

  /** A member of this school not linked to another employee. */
  private async assertLinkable(userId: string, exceptId?: string) {
    await this.userService.findById(userId);
    const linked = await this.employeeRepo.findByUserId(userId);
    if (linked && linked.id !== exceptId) {
      throw new ConflictException({
        message: 'User is already linked to another employee',
        code: 'USER_ALREADY_LINKED',
      });
    }
  }

  private async removeFileQuietly(fileId: string): Promise<void> {
    await this.files
      .remove(fileId)
      .catch((err: Error) =>
        this.logger.warn(`Could not remove file ${fileId}: ${err.message}`),
      );
  }
}
