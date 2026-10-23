import { allowAllEntitlements } from '~/modules/plans/entitlement.testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { StudentRepository } from '../repositories/student.repository';
import { StudentStatusHistoryRepository } from '../repositories/student-status-history.repository';
import { classCode, STUDENT_ID_KEY, StudentService } from './student.service';
import { Student } from '../entities/student.entity';
import { StudentStatus } from '../enums/student-status.enum';

const makeStudent = (overrides: Partial<Student> = {}): Student =>
  ({
    id: 'student-1',
    orgId: 'org-1',
    admissionNumber: '26060001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    email: null,
    phone: null,
    status: StudentStatus.ACTIVE,
    userId: null,
    photoFileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    syncFullName: () => {},
    ...overrides,
  }) as Student;

describe('StudentService', () => {
  let service: StudentService;
  let studentRepo: Record<string, jest.Mock>;
  let historyRepo: Record<string, jest.Mock>;
  let classes: { findById: jest.Mock };
  let numbering: { nextFormatted: jest.Mock };
  let numberingSettings: { studentId: string; allowManualStudentId: boolean };
  let portal: {
    studentAccounts: boolean;
    studentMinLevel: number;
    studentClassIds: string[];
  };
  let invites: { provision: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    studentRepo = {
      findByIdOrFail: jest.fn((id: string) =>
        Promise.resolve(makeStudent({ id })),
      ),
      findByAdmissionNumber: jest.fn().mockResolvedValue(null),
      findByRfid: jest.fn().mockResolvedValue(null),
      saveNew: jest.fn((data: Partial<Student>) =>
        Promise.resolve(makeStudent({ id: 'new-student', ...data })),
      ),
      updateFields: jest.fn(),
      deleteById: jest.fn(),
    };
    historyRepo = { saveNew: jest.fn(), findByStudent: jest.fn() };
    classes = {
      findById: jest.fn().mockResolvedValue({ id: 'c6', code: null, level: 6 }),
    };
    numbering = { nextFormatted: jest.fn().mockResolvedValue('26060001') };
    numberingSettings = {
      studentId: '{YY}{CLASS}{SEQ:4}',
      allowManualStudentId: false,
    };
    portal = { studentAccounts: true, studentMinLevel: 6, studentClassIds: [] };
    invites = { provision: jest.fn() };
    audit = { record: jest.fn() };
    const settings = {
      getSection: jest.fn((section: string) =>
        Promise.resolve(section === 'portal' ? portal : numberingSettings),
      ),
      today: jest.fn().mockResolvedValue('2026-03-01'),
    };

    service = new StudentService(
      studentRepo as unknown as StudentRepository,
      historyRepo as unknown as StudentStatusHistoryRepository,
      classes as never,
      { findCurrent: jest.fn() } as never,
      numbering as never,
      settings as never,
      {
        upload: jest.fn(),
        getDownloadUrl: jest.fn(),
        remove: jest.fn(),
      } as never,
      invites as never,
      allowAllEntitlements(),
      audit as never,
      { current: () => ({ userId: 'u-1' }) } as never,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it('generates the ID from the pattern, counted per year and class', async () => {
      const result = await service.create(
        { firstName: 'Ada', lastName: 'Lovelace', phone: '01712345678' },
        { classId: 'c6', date: '2026-01-10' },
      );

      expect(numbering.nextFormatted).toHaveBeenCalledWith(
        STUDENT_ID_KEY,
        '{YY}{CLASS}{SEQ:4}',
        '2606',
        expect.objectContaining({ classCode: '06' }),
      );
      expect(studentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          admissionNumber: '26060001',
          status: StudentStatus.ACTIVE,
          phone: '+8801712345678',
        }),
      );
      expect(result.id).toBe('new-student');
    });

    it('skips a generated ID someone typed in by hand', async () => {
      numbering.nextFormatted
        .mockResolvedValueOnce('26060001')
        .mockResolvedValueOnce('26060002');
      studentRepo.findByAdmissionNumber.mockImplementation((n: string) =>
        Promise.resolve(n === '26060001' ? makeStudent() : null),
      );

      await service.create(
        { firstName: 'A', lastName: 'B' },
        { classId: 'c6', date: '2026-01-10' },
      );

      expect(studentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ admissionNumber: '26060002' }),
      );
    });

    it('needs the class when the pattern uses it', async () => {
      await expect(
        service.create({ firstName: 'A', lastName: 'B' }),
      ).rejects.toMatchObject({ response: { code: 'CLASS_REQUIRED' } });
    });

    it('takes a typed ID only where the school allows it', async () => {
      await expect(
        service.create({
          admissionNumber: 'X-1',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toMatchObject({ response: { code: 'MANUAL_ID_NOT_ALLOWED' } });

      numberingSettings.allowManualStudentId = true;
      await service.create({
        admissionNumber: 'X-1',
        firstName: 'A',
        lastName: 'B',
      });
      expect(studentRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ admissionNumber: 'X-1' }),
      );
      expect(numbering.nextFormatted).not.toHaveBeenCalled();
    });

    it('rejects a taken RFID card', async () => {
      studentRepo.findByRfid.mockResolvedValue(makeStudent({ id: 'other' }));

      await expect(
        service.create(
          { firstName: 'A', lastName: 'B', rfidCardNo: 'RF-1' },
          { classId: 'c6' },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changeStatus', () => {
    it('records allowed transitions in the history and the audit log', async () => {
      await service.changeStatus('student-1', {
        status: StudentStatus.SUSPENDED,
        reason: 'Discipline',
      });

      expect(studentRepo.updateFields).toHaveBeenCalledWith('student-1', {
        status: StudentStatus.SUSPENDED,
      });
      expect(historyRepo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: StudentStatus.ACTIVE,
          toStatus: StudentStatus.SUSPENDED,
          reason: 'Discipline',
          effectiveDate: '2026-03-01',
          changedBy: 'u-1',
        }),
      );
      expect(audit.record).toHaveBeenCalled();
    });

    it('refuses transitions the lifecycle does not allow', async () => {
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ status: StudentStatus.GRADUATED }),
      );

      await expect(
        service.changeStatus('student-1', { status: StudentStatus.ACTIVE }),
      ).rejects.toThrow(BadRequestException);
      expect(historyRepo.saveNew).not.toHaveBeenCalled();
    });
  });

  describe('ensurePortalAccount', () => {
    const cls = { id: 'c6', level: 6 };

    it('makes a student login when the class qualifies', async () => {
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ email: 'ada@school.test' }),
      );
      invites.provision.mockResolvedValue({ userId: 'u-9', delivery: 'email' });

      const result = await service.ensurePortalAccount('student-1', cls);

      expect(invites.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@school.test',
          portalRole: 'student',
          membership: 'active',
        }),
      );
      expect(studentRepo.updateFields).toHaveBeenCalledWith('student-1', {
        userId: 'u-9',
      });
      expect(result?.userId).toBe('u-9');
    });

    it('skips classes below the minimum level and students without contact', async () => {
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ email: 'ada@school.test' }),
      );
      await expect(
        service.ensurePortalAccount('student-1', { id: 'c3', level: 3 }),
      ).resolves.toBeNull();

      studentRepo.findByIdOrFail.mockResolvedValue(makeStudent());
      await expect(
        service.ensurePortalAccount('student-1', cls),
      ).resolves.toBeNull();
      expect(invites.provision).not.toHaveBeenCalled();
    });

    it("doesn't share a member's account (e.g. a guardian's phone)", async () => {
      studentRepo.findByIdOrFail.mockResolvedValue(
        makeStudent({ phone: '+8801712345678' }),
      );
      invites.provision.mockRejectedValue(
        new ConflictException({ code: 'ALREADY_MEMBER' }),
      );

      await expect(
        service.ensurePortalAccount('student-1', cls),
      ).resolves.toBeNull();
      expect(studentRepo.updateFields).not.toHaveBeenCalled();
    });
  });

  it('renders the class code from the code, else the padded level', () => {
    expect(classCode({ code: 'IX', level: 9 })).toBe('IX');
    expect(classCode({ code: null, level: 6 })).toBe('06');
    expect(classCode({ code: null, level: null })).toBeNull();
  });
});
