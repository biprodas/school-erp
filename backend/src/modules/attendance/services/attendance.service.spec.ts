import { fakeTenantDataSource } from '~/tenancy/tenant-datasource.testing';
import { SYSTEM_STATUSES } from '../enums/attendance.enum';
import { AttendanceService } from './attendance.service';

const TODAY = '2026-10-22'; // a Thursday

const enrollment = (id: string, roll: string) => ({
  id,
  studentId: `s-${id}`,
  rollNo: roll,
  student: { fullName: `Student ${id}`, admissionNumber: id, nameBn: null },
});

describe('AttendanceService (submit)', () => {
  let records: {
    id: string;
    enrollmentId: string;
    statusCode: string;
    remark: string | null;
  }[];
  let inserted: Record<string, unknown>[];
  let corrections: Record<string, unknown>[];
  let events: { record: jest.Mock };
  let audit: { record: jest.Mock };
  let holiday: unknown;
  let created: boolean;
  let onLeave: Set<string>;
  let settings: Record<string, unknown>;

  const build = () => {
    const recordRepo = {
      findByRegister: jest.fn(() =>
        Promise.resolve(
          records.map((r) => ({
            ...r,
            registerId: 'reg-1',
            enrollment: undefined,
          })),
        ),
      ),
      insertMany: jest.fn((rows: Record<string, unknown>[]) => {
        inserted.push(...rows);
        records.push(
          ...rows.map((r, i) => ({
            id: `rec-new-${i}`,
            enrollmentId: r.enrollmentId as string,
            statusCode: r.statusCode as string,
            remark: (r.remark as string | null) ?? null,
          })),
        );
        return Promise.resolve();
      }),
      updateFields: jest.fn((id: string, patch: { statusCode?: string }) => {
        const r = records.find((x) => x.id === id)!;
        if (patch.statusCode) r.statusCode = patch.statusCode;
        return Promise.resolve();
      }),
      findByRegisterAndEnrollments: jest.fn((_reg: string, ids: string[]) =>
        Promise.resolve(records.filter((r) => ids.includes(r.enrollmentId))),
      ),
    };
    return new AttendanceService(
      {
        findByKey: jest.fn().mockResolvedValue(null),
        getOrCreateLocked: jest.fn(() =>
          Promise.resolve({
            register: { id: 'reg-1', clientRequestId: null },
            created,
          }),
        ),
        touch: jest.fn(),
      } as never,
      recordRepo as never,
      {
        insertMany: jest.fn((rows: Record<string, unknown>[]) => {
          corrections.push(...rows);
          return Promise.resolve();
        }),
      } as never,
      { onLeave: jest.fn(() => Promise.resolve(onLeave)) } as never,
      {
        byCode: jest
          .fn()
          .mockResolvedValue(new Map(SYSTEM_STATUSES.map((s) => [s.code, s]))),
      } as never,
      {
        findById: jest.fn().mockResolvedValue({
          id: 'sec-1',
          name: 'A',
          classId: 'cls-6',
          schoolClass: { name: 'Class 6' },
          academicYear: { startDate: '2026-01-01', endDate: '2026-12-31' },
        }),
      } as never,
      {} as never,
      {} as never,
      {
        findActiveInSection: jest
          .fn()
          .mockResolvedValue([enrollment('e1', '1'), enrollment('e2', '2')]),
      } as never,
      { findOn: jest.fn(() => Promise.resolve(holiday)) } as never,
      { findById: jest.fn() } as never,
      settings as never,
      events as never,
      audit as never,
      { current: () => ({ userId: 'u-1' }) } as never,
      fakeTenantDataSource(),
    );
  };

  const submit = (
    body: {
      records: { enrollmentId: string; status: string }[];
      reason?: string;
    },
    query: { date?: string } = {},
    canEditLocked = false,
  ) => build().submit('sec-1', query, body, { canEditLocked });

  beforeEach(() => {
    records = [];
    inserted = [];
    corrections = [];
    holiday = null;
    created = true;
    onLeave = new Set();
    events = { record: jest.fn() };
    audit = { record: jest.fn() };
    settings = {
      today: jest.fn().mockResolvedValue(TODAY),
      getSection: jest.fn((section: string) =>
        Promise.resolve(
          section === 'locale'
            ? { weekendDays: ['friday'] }
            : { mode: 'day', lockAfterDays: 7, cutoffTime: null },
        ),
      ),
    };
  });

  it('records everyone, Present unless listed, and emits the event', async () => {
    const view = await submit({
      records: [{ enrollmentId: 'e2', status: 'absent' }],
    });

    expect(inserted.map((r) => [r.enrollmentId, r.statusCode])).toEqual([
      ['e1', 'present'],
      ['e2', 'absent'],
    ]);
    expect(corrections).toEqual([]);
    expect(view.summary).toMatchObject({ present: 1, absent: 1, total: 2 });
    expect(events.record).toHaveBeenCalledWith(
      'attendance.submitted',
      expect.objectContaining({
        firstSubmission: true,
        absentEnrollmentIds: ['e2'],
      }),
    );
  });

  it('defaults students on approved leave to Leave', async () => {
    onLeave = new Set(['e1']);
    await submit({ records: [] });
    expect(inserted.find((r) => r.enrollmentId === 'e1')?.statusCode).toBe(
      'leave',
    );
  });

  it('needs a reason to override an approved leave, and records it', async () => {
    onLeave = new Set(['e1']);
    const body = { records: [{ enrollmentId: 'e1', status: 'absent' }] };
    await expect(submit(body)).rejects.toMatchObject({
      response: { code: 'CORRECTION_REASON_REQUIRED' },
    });
    expect(inserted).toEqual([]);

    await submit({ ...body, reason: 'Seen at the market' });
    expect(corrections).toEqual([
      expect.objectContaining({ oldStatus: 'leave', newStatus: 'absent' }),
    ]);
  });

  it('keeps unlisted students on a taken register and corrects changes', async () => {
    created = false;
    records = [
      { id: 'r1', enrollmentId: 'e1', statusCode: 'absent', remark: null },
      { id: 'r2', enrollmentId: 'e2', statusCode: 'present', remark: null },
    ];
    const body = { records: [{ enrollmentId: 'e1', status: 'present' }] };
    await expect(submit(body)).rejects.toMatchObject({
      response: { code: 'CORRECTION_REASON_REQUIRED' },
    });

    await submit({ ...body, reason: 'Arrived after roll call' });
    expect(inserted).toEqual([]);
    expect(records.map((r) => r.statusCode)).toEqual(['present', 'present']);
    expect(corrections).toEqual([
      expect.objectContaining({
        recordId: 'r1',
        oldStatus: 'absent',
        newStatus: 'present',
        reason: 'Arrived after roll call',
        source: 'manual',
      }),
    ]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'attendance.corrected' }),
    );
  });

  it('refuses holidays, weekend days and the future', async () => {
    holiday = { name: 'Victory Day' };
    await expect(submit({ records: [] })).rejects.toMatchObject({
      response: { code: 'ATTENDANCE_HOLIDAY' },
    });
    holiday = null;
    await expect(
      submit({ records: [] }, { date: '2026-10-23' }), // Friday
    ).rejects.toMatchObject({ response: { code: 'ATTENDANCE_HOLIDAY' } });
    await expect(
      submit({ records: [] }, { date: '2026-10-25' }),
    ).rejects.toMatchObject({ response: { code: 'ATTENDANCE_FUTURE_DATE' } });
  });

  it('locks days past the window unless the caller may edit them', async () => {
    const old = { date: '2026-10-14' }; // 8 days back, a Wednesday
    await expect(submit({ records: [] }, old)).rejects.toMatchObject({
      response: { code: 'ATTENDANCE_LOCKED' },
    });
    await expect(submit({ records: [] }, old, true)).resolves.toBeDefined();
    await expect(
      submit({ records: [] }, { date: '2026-10-15' }),
    ).resolves.toBeDefined();
  });

  it('rejects unknown statuses and students outside the register', async () => {
    await expect(
      submit({ records: [{ enrollmentId: 'e1', status: 'sick' }] }),
    ).rejects.toMatchObject({ response: { code: 'UNKNOWN_STATUS' } });
    await expect(
      submit({ records: [{ enrollmentId: 'e9', status: 'absent' }] }),
    ).rejects.toMatchObject({ response: { code: 'NOT_IN_ROSTER' } });
  });
});
