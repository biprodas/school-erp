import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AuditService } from '~/modules/audit/services/audit.service';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { JobService } from '~/modules/jobs/services/job.service';
import { SectionService } from '~/modules/sections/section.service';
import { TeachingService } from '~/modules/teaching/services/teaching.service';
import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { RolloverService } from './rollover.service';

describe('RolloverService', () => {
  let service: RolloverService;
  let years: { findById: jest.Mock };
  let sections: Record<string, jest.Mock>;
  let classSubjects: Record<string, jest.Mock>;
  let groups: Record<string, jest.Mock>;
  let teaching: Record<string, jest.Mock>;
  let jobs: { start: jest.Mock };
  let audit: { record: jest.Mock };

  const ALL = { sections: true, curriculum: true, teachers: true };

  beforeEach(() => {
    years = {
      findById: jest.fn((id: string) =>
        Promise.resolve({ id, startDate: '2027-01-01', endDate: '2027-12-31' }),
      ),
    };
    sections = {
      countInYear: jest.fn().mockResolvedValue(0),
      copyToYear: jest.fn().mockResolvedValue({
        ids: new Map([['a', 'A2']]),
        created: 1,
        skipped: 0,
      }),
      matchInYear: jest.fn().mockResolvedValue(new Map()),
    };
    classSubjects = {
      countInYear: jest.fn().mockResolvedValue(0),
      copyToYear: jest.fn().mockResolvedValue({
        ids: new Map([['m', 'M2']]),
        created: 1,
        skipped: 0,
      }),
      matchInYear: jest.fn().mockResolvedValue(new Map()),
    };
    groups = {
      copyToYear: jest.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    };
    teaching = {
      countInYear: jest.fn().mockResolvedValue(0),
      copyToYear: jest.fn().mockResolvedValue({
        classTeachers: { created: 1, skipped: 0 },
        subjectTeachers: { created: 0, skipped: 0 },
      }),
    };
    jobs = { start: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    audit = { record: jest.fn() };
    service = new RolloverService(
      years as unknown as AcademicYearService,
      sections as unknown as SectionService,
      classSubjects as unknown as ClassSubjectService,
      groups as unknown as ClassSubjectGroupService,
      teaching as unknown as TeachingService,
      jobs as unknown as JobService,
      audit as unknown as AuditService,
      fakeTenantDataSource(),
    );
  });

  it('queues the copy after checking the request', async () => {
    const job = await service.start('to', { fromYearId: 'from', include: ALL });

    expect(job).toEqual({ id: 'job-1' });
    expect(jobs.start).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: 'academic',
        name: 'session-rollover',
        data: { targetId: 'to', fromYearId: 'from', include: ALL },
      }),
    );
  });

  it('refuses a target that already has rows of an included kind', async () => {
    sections.countInYear.mockResolvedValue(3);
    teaching.countInYear.mockResolvedValue(1);

    await expect(
      service.start('to', { fromYearId: 'from', include: ALL }),
    ).rejects.toMatchObject({
      response: {
        code: 'ROLLOVER_TARGET_NOT_EMPTY',
        taken: ['sections', 'teachers'],
      },
    });
    expect(jobs.start).not.toHaveBeenCalled();
  });

  it('merges into a non-empty target when asked', async () => {
    sections.countInYear.mockResolvedValue(3);

    await service.run({
      targetId: 'to',
      fromYearId: 'from',
      include: { sections: true },
      mode: 'merge',
    });

    expect(sections.copyToYear).toHaveBeenCalledWith('from', 'to', true);
    expect(classSubjects.copyToYear).not.toHaveBeenCalled();
    expect(teaching.copyToYear).not.toHaveBeenCalled();
  });

  it('rejects an empty include and the same session', async () => {
    await expect(
      service.start('to', { fromYearId: 'from', include: {} }),
    ).rejects.toMatchObject({ response: { code: 'ROLLOVER_NOTHING_TO_COPY' } });
    await expect(
      service.start('same', { fromYearId: 'same', include: ALL }),
    ).rejects.toMatchObject({ response: { code: 'ROLLOVER_SAME_SESSION' } });
  });

  it('copies teachers onto the copied sections from the first day', async () => {
    const result = await service.run({
      targetId: 'to',
      fromYearId: 'from',
      include: ALL,
    });

    expect(teaching.copyToYear).toHaveBeenCalledWith({
      fromYearId: 'from',
      sectionIds: new Map([['a', 'A2']]),
      classSubjectIds: new Map([['m', 'M2']]),
      effectiveFrom: '2027-01-01',
    });
    expect(result).toMatchObject({
      mode: 'refuse',
      sections: { created: 1, skipped: 0 },
      classSubjects: { created: 1, skipped: 0 },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'academic_year.rolled_over',
        entityId: 'to',
      }),
    );
  });

  it('maps teachers onto existing rows when sections are not copied', async () => {
    await service.run({
      targetId: 'to',
      fromYearId: 'from',
      include: { teachers: true },
    });

    expect(sections.matchInYear).toHaveBeenCalledWith('from', 'to');
    expect(classSubjects.matchInYear).toHaveBeenCalledWith('from', 'to');
    expect(sections.copyToYear).not.toHaveBeenCalled();
  });
});
