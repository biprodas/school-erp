import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RoleRepository } from '../rbac/role.repository';
import { UserService } from '../users/user.service';
import { StudentRepository } from './student.repository';
import { StudentService } from './student.service';
import { Student } from './entities/student.entity';
import { StudentStatus } from './enums/student-status.enum';

const makeStudent = (overrides: Partial<Student> = {}): Student => ({
  id: 'student-1',
  admissionNumber: 'ADM-001',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  dob: null,
  gender: null,
  guardianName: null,
  guardianPhone: null,
  address: null,
  status: StudentStatus.ACTIVE,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  syncFullName: () => {},
  ...overrides,
});

describe('StudentService', () => {
  let service: StudentService;
  let studentRepo: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let roleRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    studentRepo = {
      findAll: jest.fn(),
      findByIdOrFail: jest.fn(),
      findByAdmissionNumber: jest.fn(),
      findByUserId: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data) =>
        Promise.resolve(makeStudent({ id: 'new-student', ...data })),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
      deleteById: jest.fn(),
    };
    userService = {
      findById: jest.fn(),
      create: jest.fn(),
    };
    roleRepo = {
      findByName: jest.fn(),
    };

    service = new StudentService(
      studentRepo as unknown as StudentRepository,
      userService as unknown as UserService,
      roleRepo as unknown as RoleRepository,
    );
  });

  describe('create', () => {
    it('creates a student with no user link', async () => {
      studentRepo.findByAdmissionNumber.mockResolvedValue(null);
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ id: 'new-student' }),
      );

      const result = await service.create({
        admissionNumber: 'ADM-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      expect(result.id).toBe('new-student');
      expect(studentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          admissionNumber: 'ADM-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          userId: null,
          status: StudentStatus.ACTIVE,
        }),
      );
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('links an existing tenant user', async () => {
      studentRepo.findByAdmissionNumber.mockResolvedValue(null);
      userService.findById.mockResolvedValue({ id: 'user-7' });
      studentRepo.findByUserId.mockResolvedValue(null);
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ id: 'new-student', userId: 'user-7' }),
      );

      const result = await service.create({
        admissionNumber: 'ADM-002',
        firstName: 'Grace',
        lastName: 'Hopper',
        userId: 'user-7',
      });

      expect(userService.findById).toHaveBeenCalledWith('user-7');
      expect(studentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-7' }),
      );
      expect(result.userId).toBe('user-7');
    });

    it('provisions a new user with the student role when createUser is set', async () => {
      studentRepo.findByAdmissionNumber.mockResolvedValue(null);
      roleRepo.findByName.mockResolvedValue({ id: 'role-student' });
      userService.create.mockResolvedValue({ id: 'new-user' });
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ id: 'new-student', userId: 'new-user' }),
      );

      const result = await service.create({
        admissionNumber: 'ADM-003',
        firstName: 'Linus',
        lastName: 'Torvalds',
        createUser: { email: 'linus@example.com', password: 'secret123' },
      });

      expect(roleRepo.findByName).toHaveBeenCalledWith('student');
      expect(userService.create).toHaveBeenCalledWith({
        name: 'Linus Torvalds',
        email: 'linus@example.com',
        password: 'secret123',
        roleIds: ['role-student'],
      });
      expect(studentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'new-user' }),
      );
      expect(result.userId).toBe('new-user');
    });

    it('rejects when both userId and createUser are provided', async () => {
      await expect(
        service.create({
          admissionNumber: 'ADM-004',
          firstName: 'A',
          lastName: 'B',
          userId: 'user-1',
          createUser: { email: 'a@b.com', password: 'secret123' },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(studentRepo.saveNew).not.toHaveBeenCalled();
    });

    it('rejects a duplicate admission number', async () => {
      studentRepo.findByAdmissionNumber.mockResolvedValue(makeStudent());

      await expect(
        service.create({
          admissionNumber: 'ADM-001',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when the user is already linked to another student', async () => {
      studentRepo.findByAdmissionNumber.mockResolvedValue(null);
      userService.findById.mockResolvedValue({ id: 'user-7' });
      studentRepo.findByUserId.mockResolvedValue(
        makeStudent({ id: 'other-student' }),
      );

      await expect(
        service.create({
          admissionNumber: 'ADM-005',
          firstName: 'X',
          lastName: 'Y',
          userId: 'user-7',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when the student system role is missing', async () => {
      studentRepo.findByAdmissionNumber.mockResolvedValue(null);
      roleRepo.findByName.mockResolvedValue(null);

      await expect(
        service.create({
          admissionNumber: 'ADM-006',
          firstName: 'X',
          lastName: 'Y',
          createUser: { email: 'x@y.com', password: 'secret123' },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects a conflicting admission number from another student', async () => {
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ id: 'student-1', admissionNumber: 'ADM-001' }),
      );
      studentRepo.findByAdmissionNumber.mockResolvedValue(
        makeStudent({ id: 'student-2', admissionNumber: 'ADM-002' }),
      );

      await expect(
        service.update('student-1', { admissionNumber: 'ADM-002' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates allowed fields', async () => {
      studentRepo.findByIdOrFail
        .mockResolvedValueOnce(makeStudent())
        .mockResolvedValueOnce(makeStudent({ guardianName: 'Mom' }));

      const result = await service.update('student-1', { guardianName: 'Mom' });

      expect(studentRepo.save).toHaveBeenCalled();
      expect(result.guardianName).toBe('Mom');
    });
  });

  describe('remove', () => {
    it('deletes after verifying existence', async () => {
      studentRepo.findByIdOrFail.mockResolvedValue(makeStudent());

      await service.remove('student-1');

      expect(studentRepo.deleteById).toHaveBeenCalledWith('student-1');
    });
  });

  describe('findFiltered', () => {
    it('passes only provided filters to the repository', async () => {
      studentRepo.findFiltered.mockResolvedValue([]);

      await service.findFiltered({
        status: StudentStatus.ACTIVE,
        firstName: 'Ada',
      });

      expect(studentRepo.findFiltered).toHaveBeenCalledWith({
        status: StudentStatus.ACTIVE,
        firstName: 'Ada',
      });
    });
  });
});
