import { BadRequestException, ConflictException } from '@nestjs/common';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { SectionService } from '~/modules/sections/section.service';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { ClassTeacherRepository } from '../repositories/class-teacher.repository';
import { ClassTeacherService } from './class-teacher.service';
import { ClassTeacher } from '../entities/class-teacher.entity';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';

const SESSION = { startDate: '2026-01-01', endDate: '2026-12-31' };

const makeCT = (overrides: Partial<ClassTeacher> = {}): ClassTeacher =>
  ({
    id: 'ct-1',
    sectionId: 'sec-1',
    employeeId: 'emp-1',
    isPrimary: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    section: { academicYear: SESSION },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ClassTeacher;

describe('ClassTeacherService', () => {
  let service: ClassTeacherService;
  let repo: Record<string, jest.Mock>;
  let sectionService: Record<string, jest.Mock>;
  let yearService: Record<string, jest.Mock>;
  let employeeService: Record<string, jest.Mock>;
  let settings: { today: jest.Mock };

  beforeEach(() => {
    repo = {
      findByIdWithRelations: jest.fn((id: string) =>
        Promise.resolve(makeCT({ id })),
      ),
      findCurrent: jest.fn().mockResolvedValue(null),
      clearPrimary: jest.fn(),
      findFiltered: jest.fn(),
      saveNew: jest.fn((data: Partial<ClassTeacher>) =>
        Promise.resolve(makeCT({ id: 'new-ct', ...data })),
      ),
      updateFields: jest.fn(),
      deleteById: jest.fn(),
    };
    sectionService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'sec-1', academicYearId: 'ay-1' }),
    };
    yearService = { findById: jest.fn().mockResolvedValue(SESSION) };
    employeeService = {
      findById: jest.fn().mockResolvedValue({ id: 'emp-2', status: 'active' }),
    };
    settings = { today: jest.fn().mockResolvedValue('2026-06-15') };

    service = new ClassTeacherService(
      repo as unknown as ClassTeacherRepository,
      sectionService as unknown as SectionService,
      yearService as unknown as AcademicYearService,
      employeeService as unknown as EmployeeService,
      settings as unknown as SettingsService,
      fakeTenantDataSource(),
    );
  });

  describe('create', () => {
    it("starts on the session's first day by default", async () => {
      await service.create({
        sectionId: 'sec-1',
        employeeId: 'emp-1',
        isPrimary: true,
      });

      expect(repo.clearPrimary).toHaveBeenCalledWith('sec-1');
      expect(repo.saveNew).toHaveBeenCalledWith({
        sectionId: 'sec-1',
        employeeId: 'emp-1',
        isPrimary: true,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      });
    });

    it('rejects a start outside the session', async () => {
      await expect(
        service.create({
          sectionId: 'sec-1',
          employeeId: 'emp-1',
          effectiveFrom: '2025-12-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a second current row for the same teacher', async () => {
      repo.findCurrent.mockResolvedValue(makeCT());

      await expect(
        service.create({ sectionId: 'sec-1', employeeId: 'emp-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects staff who left', async () => {
      employeeService.findById.mockResolvedValue({ status: 'terminated' });

      await expect(
        service.create({ sectionId: 'sec-1', employeeId: 'emp-1' }),
      ).rejects.toMatchObject({ response: { code: 'EMPLOYEE_NOT_ACTIVE' } });
    });
  });

  describe('change (handover)', () => {
    it('ends the current row the day before and opens a new one', async () => {
      await service.change('ct-1', {
        employeeId: 'emp-2',
        effectiveFrom: '2026-06-01',
      });

      expect(repo.updateFields).toHaveBeenCalledWith('ct-1', {
        effectiveTo: '2026-05-31',
      });
      expect(repo.saveNew).toHaveBeenCalledWith({
        sectionId: 'sec-1',
        employeeId: 'emp-2',
        isPrimary: true,
        effectiveFrom: '2026-06-01',
        effectiveTo: null,
      });
      // The old row is ended before the new primary is inserted.
      expect(repo.updateFields.mock.invocationCallOrder[0]).toBeLessThan(
        repo.saveNew.mock.invocationCallOrder[0],
      );
    });

    it('hands over from today by default', async () => {
      await service.change('ct-1', { employeeId: 'emp-2' });

      expect(repo.updateFields).toHaveBeenCalledWith('ct-1', {
        effectiveTo: '2026-06-14',
      });
      expect(repo.saveNew).toHaveBeenCalledWith(
        expect.objectContaining({ effectiveFrom: '2026-06-15' }),
      );
    });

    it('re-points a row that never took effect', async () => {
      await service.change('ct-1', {
        employeeId: 'emp-2',
        effectiveFrom: '2026-01-01',
      });

      expect(repo.updateFields).toHaveBeenCalledWith('ct-1', {
        employeeId: 'emp-2',
        isPrimary: true,
      });
      expect(repo.saveNew).not.toHaveBeenCalled();
    });

    it('refuses to change an ended row', async () => {
      repo.findByIdWithRelations.mockResolvedValue(
        makeCT({ effectiveTo: '2026-03-31' }),
      );

      await expect(
        service.change('ct-1', { employeeId: 'emp-2' }),
      ).rejects.toMatchObject({ response: { code: 'ASSIGNMENT_ENDED' } });
    });

    it('refuses a handover before the row started', async () => {
      repo.findByIdWithRelations.mockResolvedValue(
        makeCT({ effectiveFrom: '2026-04-01' }),
      );

      await expect(
        service.change('ct-1', {
          employeeId: 'emp-2',
          effectiveFrom: '2026-03-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('end and remove', () => {
    it('ends a current row on the given day', async () => {
      await service.end('ct-1', { effectiveTo: '2026-09-30' });

      expect(repo.updateFields).toHaveBeenCalledWith('ct-1', {
        effectiveTo: '2026-09-30',
      });
    });

    it('deletes a current row but keeps history', async () => {
      await service.remove('ct-1');
      expect(repo.deleteById).toHaveBeenCalledWith('ct-1');

      repo.findByIdWithRelations.mockResolvedValue(
        makeCT({ effectiveTo: '2026-03-31' }),
      );
      await expect(service.remove('ct-1')).rejects.toMatchObject({
        response: { code: 'ASSIGNMENT_HISTORY' },
      });
    });
  });
});
