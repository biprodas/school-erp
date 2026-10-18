import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from '~/modules/rbac/services/role.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { DepartmentService } from '~/modules/departments/department.service';
import { DesignationService } from '~/modules/designations/designation.service';
import { EmployeeRepository } from './employee.repository';
import { EmployeeService } from './employee.service';
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
  email: null,
  phone: null,
  gender: null,
  dob: null,
  address: null,
  joiningDate: null,
  qualification: null,
  status: EmployeeStatus.ACTIVE,
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
  let roleRepo: Record<string, jest.Mock>;
  let departmentRepo: Record<string, jest.Mock>;
  let designationRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    employeeRepo = {
      findByIdWithRelations: jest.fn(),
      findByEmployeeNumber: jest.fn(),
      findByUserId: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<Employee>) =>
        Promise.resolve(makeEmployee({ id: 'new-emp', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    userService = {
      findById: jest.fn(),
      create: jest.fn(),
    };
    roleRepo = {
      findById: jest.fn(),
    };
    departmentRepo = {
      findById: jest.fn(),
    };
    designationRepo = {
      findById: jest.fn(),
    };

    service = new EmployeeService(
      employeeRepo as unknown as EmployeeRepository,
      userService as unknown as OrgUserService,
      roleRepo as unknown as RoleService,
      departmentRepo as unknown as DepartmentService,
      designationRepo as unknown as DesignationService,
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
      expect(userService.create).not.toHaveBeenCalled();
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

    it('provisions a new user with the given roles when createUser is set', async () => {
      employeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      roleRepo.findById.mockResolvedValue({ id: 'role-teacher' });
      userService.create.mockResolvedValue({ id: 'new-user' });
      employeeRepo.findByIdWithRelations.mockResolvedValue(
        makeEmployee({ id: 'new-emp', userId: 'new-user' }),
      );

      const result = await service.create({
        employeeNumber: 'EMP-003',
        firstName: 'Linus',
        lastName: 'Torvalds',
        createUser: {
          email: 'linus@example.com',
          password: 'secret123',
          roleIds: ['role-teacher'],
        },
      });

      expect(roleRepo.findById).toHaveBeenCalledWith('role-teacher');
      expect(userService.create).toHaveBeenCalledWith({
        name: 'Linus Torvalds',
        email: 'linus@example.com',
        password: 'secret123',
        roleIds: ['role-teacher'],
      });
      expect(result.userId).toBe('new-user');
    });

    it('rejects when both userId and createUser are provided', async () => {
      await expect(
        service.create({
          employeeNumber: 'EMP-004',
          firstName: 'A',
          lastName: 'B',
          userId: 'user-1',
          createUser: {
            email: 'a@b.com',
            password: 'secret123',
            roleIds: ['role-1'],
          },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(employeeRepo.saveNew).not.toHaveBeenCalled();
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

    it('updates allowed fields', async () => {
      employeeRepo.findByIdWithRelations
        .mockResolvedValueOnce(makeEmployee())
        .mockResolvedValueOnce(makeEmployee({ phone: '0123' }));

      const result = await service.update('emp-1', { phone: '0123' });

      expect(employeeRepo.save).toHaveBeenCalled();
      expect(result.phone).toBe('0123');
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
