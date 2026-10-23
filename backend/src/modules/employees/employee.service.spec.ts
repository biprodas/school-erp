import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '~/modules/audit/services/audit.service';
import { InviteService } from '~/modules/auth/services/invite.service';
import { FileService } from '~/modules/files/file.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { DepartmentService } from '~/modules/departments/department.service';
import { DesignationService } from '~/modules/designations/designation.service';
import { EmployeeRepository } from './employee.repository';
import { EMPLOYEE_NUMBER_KEY, EmployeeService } from './employee.service';
import { Employee } from './entities/employee.entity';
import { EmployeeStatus } from './enums/employee-status.enum';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';

const makeEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  orgId: 'org-1',
  employeeNumber: 'EMP-001',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  nameBn: null,
  nid: null,
  photoFileId: null,
  email: null,
  phone: null,
  gender: null,
  dob: null,
  address: null,
  joiningDate: null,
  qualification: null,
  status: EmployeeStatus.ACTIVE,
  employmentType: null,
  departmentId: null,
  designationId: null,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  syncFullName: () => {},
  ...overrides,
});

describe('EmployeeService', () => {
  let service: EmployeeService;
  let employeeRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let departmentRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;
  let numbering: Record<string, jest.Mock>;
  let settings: Record<string, jest.Mock>;
  let files: Record<string, jest.Mock>;
  let invites: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;

  beforeEach(() => {
    employeeRepo = {
      findByIdWithRelations: jest.fn(),
      findByEmployeeNumber: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<Employee>) =>
        Promise.resolve(makeEmployee({ id: 'new-emp', ...data })),
      ),
      updateFields: jest.fn(),
      deleteById: jest.fn(),
    };
    userService = { findById: jest.fn() };
    departmentRepo = { findById: jest.fn() };
    designationRepo = { findById: jest.fn() };
    numbering = { nextFormatted: jest.fn().mockResolvedValue('EMP-0001') };
    settings = {
      getSection: jest.fn().mockResolvedValue({ employeeId: 'EMP-{SEQ:4}' }),
    };
    files = {
      upload: jest.fn().mockResolvedValue({ id: 'file-new' }),
      getDownloadUrl: jest.fn().mockResolvedValue('https://signed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    invites = { invite: jest.fn() };
    audit = { record: jest.fn() };

    service = new EmployeeService(
      employeeRepo as unknown as EmployeeRepository,
      userService as unknown as OrgUserService,
      departmentRepo as unknown as DepartmentService,
      designationRepo as unknown as DesignationService,
      numbering as unknown as NumberingService,
      settings as unknown as SettingsService,
      files as unknown as FileService,
      invites as unknown as InviteService,
      audit as unknown as AuditService,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it('creates an employee with no user link', async () => {
      employeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ id: 'new-emp' }),
      );

      const result = await service.create({
        employeeNumber: 'EMP-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      expect(result.id).toBe('new-emp');
      expect(employeeRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeNumber: 'EMP-001',
          userId: null,
          status: EmployeeStatus.ACTIVE,
        }),
      );
      expect(numbering.nextFormatted).not.toHaveBeenCalled();
    });

    it('validates department and designation when provided', async () => {
      employeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      departmentRepo.findById.mockResolvedValue({ id: 'dept-1' });
      designationRepo.findById.mockResolvedValue({ id: 'desig-1' });
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({
          id: 'new-emp',
          departmentId: 'dept-1',
          designationId: 'desig-1',
        }),
      );

      await service.create({
        employeeNumber: 'EMP-010',
        firstName: 'Grace',
        lastName: 'Hopper',
        departmentId: 'dept-1',
        designationId: 'desig-1',
      });

      expect(departmentRepo.findById).toHaveBeenCalledWith('dept-1');
      expect(designationRepo.findById).toHaveBeenCalledWith('desig-1');
    });

    it('generates the number from the school pattern when none is given', async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(makeEmployee());

      await service.create({ firstName: 'Linus', lastName: 'Torvalds' });

      expect(numbering.nextFormatted).toHaveBeenCalledWith(
        EMPLOYEE_NUMBER_KEY,
        'EMP-{SEQ:4}',
      );
      expect(employeeRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ employeeNumber: 'EMP-0001' }),
      );
    });

    it('skips generated numbers someone typed in by hand', async () => {
      numbering.nextFormatted
        .mockResolvedValueOnce('EMP-0001')
        .mockResolvedValueOnce('EMP-0002');
      employeeRepo.findByEmployeeNumber.mockImplementation((n: string) =>
        Promise.resolve(n === 'EMP-0001' ? makeEmployee() : null),
      );
      employeeRepo.findByIdWithRelations.mockResolvedValue(makeEmployee());

      await service.create({ firstName: 'A', lastName: 'B' });

      expect(employeeRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ employeeNumber: 'EMP-0002' }),
      );
    });

    it('rejects a duplicate employee number', async () => {
      employeeRepo.findByEmployeeNumber.mockResolvedValue(makeEmployee());

      await expect(
        service.create({
          employeeNumber: 'EMP-001',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an invalid department id', async () => {
      employeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      departmentRepo.findById.mockRejectedValue(new NotFoundException());

      await expect(
        service.create({
          employeeNumber: 'EMP-006',
          firstName: 'X',
          lastName: 'Y',
          departmentId: 'missing',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(employeeRepo.saveNew).not.toHaveBeenCalled();
    });

    it('rejects when the user is already linked to another employee', async () => {
      employeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      userService.findById.mockResolvedValue({ id: 'user-7' });
      employeeRepo.findByUserId.mockResolvedValue(
        makeEmployee({ id: 'other-emp' }),
      );

      await expect(
        service.create({
          employeeNumber: 'EMP-005',
          firstName: 'X',
          lastName: 'Y',
          userId: 'user-7',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('rejects a conflicting employee number from another employee', async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ id: 'emp-1', employeeNumber: 'EMP-001' }),
      );
      employeeRepo.findByEmployeeNumber.mockResolvedValue(
        makeEmployee({ id: 'emp-2', employeeNumber: 'EMP-002' }),
      );

      await expect(
        service.update('emp-1', { employeeNumber: 'EMP-002' }),
      ).rejects.toThrow(ConflictException);
    });

    it('writes the changed columns', async () => {
      employeeRepo.findByIdWithRelations
        .mockResolvedValueOnce(makeEmployee())
        .mockResolvedValueOnce(makeEmployee({ phone: '01712345678' }));

      const result = await service.update('emp-1', { phone: '01712345678' });

      expect(employeeRepo.updateFields).toHaveBeenCalledWith('emp-1', {
        phone: '01712345678',
      });
      expect(result.phone).toBe('01712345678');
    });
  });

  describe('invite', () => {
    const teacher = { defaultRoleId: 'role-teacher' };

    it("invites by email with the designation's default role and links the login", async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({
          email: 'ada@school.test',
          phone: '01712345678',
          designation: teacher as Employee['designation'],
        }),
      );
      invites.invite.mockResolvedValue({ userId: 'user-9', delivery: 'email' });

      const result = await service.invite('emp-1', {});

      expect(invites.invite).toHaveBeenCalledWith({
        name: 'Ada Lovelace',
        email: 'ada@school.test',
        phone: undefined,
        roleIds: ['role-teacher'],
      });
      expect(employeeRepo.updateFields).toHaveBeenCalledWith('emp-1', {
        userId: 'user-9',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'employee.invited' }),
      );
      expect(result.delivery).toBe('email');
    });

    it('falls back to the phone (slip) and takes explicit roles', async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ phone: '01712345678' }),
      );
      invites.invite.mockResolvedValue({ userId: 'user-9', delivery: 'slip' });

      await service.invite('emp-1', { roleIds: ['role-x'] });

      expect(invites.invite).toHaveBeenCalledWith(
        expect.objectContaining({
          email: undefined,
          phone: '01712345678',
          roleIds: ['role-x'],
        }),
      );
    });

    it('refuses without a role, contact, or when already linked', async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ email: 'ada@school.test' }),
      );
      await expect(service.invite('emp-1', {})).rejects.toMatchObject({
        response: { code: 'ROLE_REQUIRED' },
      });

      employeeRepo.findByIdWithRelations.mockResolvedValue(makeEmployee());
      await expect(
        service.invite('emp-1', { roleIds: ['r'] }),
      ).rejects.toMatchObject({ response: { code: 'IDENTIFIER_REQUIRED' } });

      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ userId: 'user-1' }),
      );
      await expect(
        service.invite('emp-1', { roleIds: ['r'] }),
      ).rejects.toMatchObject({
        response: { code: 'EMPLOYEE_ALREADY_LINKED' },
      });
      expect(invites.invite).not.toHaveBeenCalled();
    });
  });

  describe('setPhoto', () => {
    it('stores the new photo and removes the previous one', async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ photoFileId: 'file-old' }),
      );

      const result = await service.setPhoto('emp-1', {
        buffer: Buffer.from('x'),
        originalName: 'me.png',
      });

      expect(files.upload).toHaveBeenCalledWith(
        expect.anything(),
        'employee_photo',
      );
      expect(employeeRepo.updateFields).toHaveBeenCalledWith('emp-1', {
        photoFileId: 'file-new',
      });
      expect(files.remove).toHaveBeenCalledWith('file-old');
      expect(result).toEqual({ fileId: 'file-new', url: 'https://signed' });
    });
  });

  describe('remove', () => {
    it('deletes after verifying existence', async () => {
      employeeRepo.findByIdWithRelations.mockResolvedValue(makeEmployee());

      await service.remove('emp-1');

      expect(employeeRepo.deleteById).toHaveBeenCalledWith('emp-1');
    });
  });

  describe('findFiltered', () => {
    it('passes only provided filters, plus the page, to the repository', async () => {
      employeeRepo.findFiltered.mockResolvedValue([]);
      const filter = {
        status: EmployeeStatus.ACTIVE,
        departmentId: 'dept-1',
        page: 2,
        limit: 10,
      };

      await service.findFiltered(filter);

      expect(employeeRepo.findFiltered).toHaveBeenCalledWith(
        {
          status: EmployeeStatus.ACTIVE,
          departmentId: 'dept-1',
        },
        filter,
      );
    });
  });
});
