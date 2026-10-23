import { randomInt, randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { Like } from 'typeorm';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';
import { MemoryStorage, withMemoryStorage } from './support/storage';

jest.setTimeout(180_000);

interface Row {
  id: string;
  [key: string]: unknown;
}
interface StudentRow extends Row {
  admissionNumber: string;
  status: string;
  fullName: string;
}
interface ImportView {
  status: string;
  totals: {
    rows: number;
    valid: number;
    invalid: number;
    committed?: number;
    skipped?: number;
  };
  errors: { row: number; column: string; code: string }[];
  rows: { row: number; status: string; result?: Record<string, unknown> }[];
}
interface JobView {
  status: string;
  result: Record<string, unknown> | null;
  downloadUrl: string | null;
  error: string | null;
}

/** A 1×1 PNG, for photo uploads. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

/**
 * M3 acceptance (backend plan 7): student IDs from the pattern under
 * concurrency, the Excel import in both modes, transfers and status,
 * promotion preview/commit/rollback, sensitive data hidden without the
 * permission, certificates verified by their QR code, ID cards.
 */
describe('Student information system (e2e)', () => {
  let e: E2eApp;
  const storage = new MemoryStorage();
  const runId = randomUUID().slice(0, 8);
  // Guardians' phones make global accounts: unique per run.
  const phoneBase = `01${randomInt(3, 10)}${String(randomInt(0, 1000)).padStart(3, '0')}`;
  const phone = (i: number) => `${phoneBase}${String(i).padStart(5, '0')}`;
  const Y1 = new Date().getFullYear();
  const Y2 = Y1 + 1;
  const YY = String(Y1 % 100).padStart(2, '0');

  const schools: Record<'a' | 'b', { org: Organization; token: string }> =
    {} as never;
  let teacherToken: string;
  const ids: Record<string, string> = {};

  const as = (token: string, org: Organization) => {
    const req = (
      method: 'get' | 'post' | 'patch' | 'put' | 'delete',
      url: string,
    ) =>
      e
        .http()
        [method](url)
        .set('x-tenant-id', org.slug)
        .set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => req('get', url),
      post: (url: string, body: object = {}) => req('post', url).send(body),
      patch: (url: string, body: object) => req('patch', url).send(body),
      put: (url: string, body: object) => req('put', url).send(body),
      upload: (url: string) => req('post', url),
    };
  };
  const admin = () => as(schools.a.token, schools.a.org);
  const teacher = () => as(teacherToken, schools.a.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
  const job = async (id: string) => {
    await drain();
    return data<JobView>(await admin().get(`/api/jobs/${id}`).expect(200));
  };

  async function makeSchool(key: 'a' | 'b') {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m3-${key}-${runId}@e2e.test`,
        name: `Owner ${key}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M3 ${key} ${runId}`,
        slug: `e2e-m3-${key}-${runId}`,
        type: OrganizationType.SCHOOL,
        ownerUserId: owner.id,
      }),
    );
    const { sessionId } = await e.app
      .get(SessionService)
      .start(owner.id, org.id);
    schools[key] = {
      org,
      token: e.jwt.sign({
        sub: owner.id,
        orgId: org.id,
        isAdmin: true,
        sid: sessionId,
      }),
    };
  }

  const created = async (res: Promise<{ body: unknown }>) =>
    data<Row>(await res).id;

  beforeAll(async () => {
    e = await bootApp(withMemoryStorage(storage), { PDF_NO_SANDBOX: 'true' });
    await makeSchool('a');
    await makeSchool('b');

    const year = (y: number, isCurrent: boolean) =>
      created(
        admin()
          .post('/api/academic-years', {
            name: `${y}`,
            startDate: `${y}-01-01`,
            endDate: `${y}-12-31`,
            isCurrent,
          })
          .expect(201),
      );
    ids.y1 = await year(Y1, true);
    ids.y2 = await year(Y2, false);
    for (const [name, level] of [
      ['Class 6', 6],
      ['Class 7', 7],
      ['Class 9', 9],
      ['Class 10', 10],
    ] as const) {
      ids[name] = await created(
        admin().post('/api/classes', { name, level }).expect(201),
      );
    }
    const section = (year: string, cls: string, name: string) =>
      created(
        admin()
          .post('/api/sections', {
            academicYearId: ids[year],
            classId: ids[cls],
            name,
          })
          .expect(201),
      );
    ids['9A'] = await section('y1', 'Class 9', 'A');
    ids['9B'] = await section('y1', 'Class 9', 'B');
    ids['10A'] = await section('y1', 'Class 10', 'A');
    ids['6A'] = await section('y1', 'Class 6', 'A');
    ids['next 7A'] = await section('y2', 'Class 7', 'A');
    ids['next 7B'] = await section('y2', 'Class 7', 'B');
    ids['next 6A'] = await section('y2', 'Class 6', 'A');
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-m3-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m3-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone LIKE $1`, [
        `+880${phoneBase.slice(1)}%`,
      ]);
    }
    await e?.close();
  });

  it('gives student IDs from the pattern, without duplicates under concurrency', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        admin().post('/api/students', {
          classId: ids['Class 6'],
          firstName: `Con${i}`,
          lastName: 'Current',
        }),
      ),
    );
    for (const res of responses) expect(res.status).toBe(201);
    const numbers = responses.map((r) => data<StudentRow>(r).admissionNumber);
    expect(new Set(numbers).size).toBe(20);
    for (const n of numbers) expect(n).toMatch(new RegExp(`^${YY}06\\d{4}$`));
    expect([...numbers].sort()[0]).toBe(`${YY}060001`);

    const typed = await admin()
      .post('/api/students', {
        admissionNumber: 'TYPED-1',
        firstName: 'A',
        lastName: 'B',
      })
      .expect(400);
    expect(error(typed).code).toBe('MANUAL_ID_NOT_ALLOWED');
    const noClass = await admin()
      .post('/api/students', { firstName: 'A', lastName: 'B' })
      .expect(400);
    expect(error(noClass).code).toBe('CLASS_REQUIRED');
  });

  it('imports 500 students with guardians, showing row errors before commit, in both modes', async () => {
    const template = await admin()
      .get('/api/imports/templates/students')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(template.headers['content-type']).toContain('spreadsheetml');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(template.body as ArrayBuffer);
    const ws = wb.worksheets[0];
    const headers = (ws.getRow(1).values as (string | undefined)[]).map((v) =>
      (v ?? '').replace(/ \*$/, ''),
    );
    // Write from row 2 over the example row (the dropdowns reach row 1000,
    // so `addRow` would start after them).
    let next = 2;
    const addRow = (values: Record<string, string | number>) => {
      const row = ws.getRow(next++);
      headers.forEach((h, i) => {
        if (i > 0) row.getCell(i).value = values[h] ?? null;
      });
      row.commit();
    };

    for (let i = 0; i < 500; i++) {
      // Every 10th student is a sibling of the one before (same father).
      const father = i % 10 === 9 ? i - 1 : i;
      addRow({
        'First name': `Student${i}`,
        'Last name': `Import${runId}`,
        Gender: 'male',
        'Date of birth': '2012-05-01',
        Class: 'Class 9',
        Section: i % 2 ? 'B' : 'A',
        Roll: Math.floor(i / 2) + 1,
        'Father name': `Father ${father}`,
        'Father phone': phone(father),
      });
    }
    addRow({
      'First name': 'Bad',
      'Last name': 'Class',
      Class: 'Class 99',
      Section: 'A',
      'Father name': 'F',
      'Father phone': phone(900),
    });
    addRow({
      'First name': 'Bad',
      'Last name': 'Phone',
      Class: 'Class 9',
      Section: 'A',
      'Father name': 'F',
      'Father phone': 'abc',
    });
    addRow({
      'First name': 'Bad',
      'Last name': 'Roll',
      Class: 'Class 9',
      Section: 'A',
      Roll: 1,
      'Father name': 'F',
      'Father phone': phone(901),
    });
    const file = Buffer.from(await wb.xlsx.writeBuffer());

    const started = Date.now();
    const upload = await admin()
      .upload('/api/imports')
      .field('type', 'students')
      .field('mode', 'all_or_nothing')
      .attach('file', file, 'students.xlsx')
      .expect(202);
    const { import: imported, job: validation } = data<{
      import: Row;
      job: Row;
    }>(upload);
    expect((await job(validation.id)).status).toBe('succeeded');

    const preview = data<ImportView>(
      await admin().get(`/api/imports/${imported.id}`).expect(200),
    );
    expect(preview.status).toBe('validated');
    expect(preview.totals).toEqual({ rows: 503, valid: 500, invalid: 3 });
    expect(preview.errors.map((err) => [err.row, err.code]).sort()).toEqual([
      // The template's class dropdown catches it while parsing.
      [502, 'INVALID_OPTION'],
      [503, 'INVALID_PHONE'],
      [504, 'DUPLICATE_IN_FILE'],
    ]);

    // All or nothing: refused while rows have errors.
    const refused = await admin()
      .post(`/api/imports/${imported.id}/commit`)
      .expect(409);
    expect(error(refused).code).toBe('IMPORT_HAS_ERRORS');

    const commit = data<Row>(
      await admin()
        .post(`/api/imports/${imported.id}/commit`, { mode: 'valid_only' })
        .expect(202),
    );
    const committed = await job(commit.id);
    expect(committed.status).toBe('succeeded');
    expect(Date.now() - started).toBeLessThan(60_000);

    const done = data<ImportView>(
      await admin().get(`/api/imports/${imported.id}`).expect(200),
    );
    expect(done.status).toBe('done');
    expect(done.totals).toMatchObject({ committed: 500, skipped: 3 });

    const inA = await admin()
      .get(`/api/students?sectionId=${ids['9A']}&limit=1`)
      .expect(200);
    expect((inA.body as { meta: { total: number } }).meta.total).toBe(250);
    // Siblings share the guardian found by phone.
    const sibling = done.rows.find((r) => r.row === 11)!.result!; // student 9
    const elder = done.rows.find((r) => r.row === 10)!.result!; // student 8
    expect(sibling.guardianIds).toEqual(elder.guardianIds);
    ids.imported = sibling.studentId as string;
    const guardian = data<Row & { userId: string | null; phone: string }>(
      await admin()
        .get(`/api/guardians/${(sibling.guardianIds as string[])[0]}`)
        .expect(200),
    );
    expect(guardian.phone).toBe(`+880${phone(8).slice(1)}`);
    expect(guardian.userId).not.toBeNull(); // portal login made

    // A clean file commits all or nothing.
    const small = new ExcelJS.Workbook();
    const sws = small.addWorksheet('Students');
    sws.addRow([
      'First name',
      'Last name',
      'Class',
      'Section',
      'Roll',
      'Father name',
      'Father phone',
    ]);
    for (let i = 0; i < 5; i++) {
      sws.addRow([
        `Senior${i}`,
        `Import${runId}`,
        'Class 10',
        'A',
        i + 1,
        `Elder ${i}`,
        phone(600 + i),
      ]);
    }
    const second = data<{ import: Row; job: Row }>(
      await admin()
        .upload('/api/imports')
        .field('type', 'students')
        .attach(
          'file',
          Buffer.from(await small.xlsx.writeBuffer()),
          'seniors.xlsx',
        )
        .expect(202),
    );
    await job(second.job.id);
    const commitSmall = data<Row>(
      await admin().post(`/api/imports/${second.import.id}/commit`).expect(202),
    );
    expect((await job(commitSmall.id)).status).toBe('succeeded');
    const smallDone = data<ImportView>(
      await admin().get(`/api/imports/${second.import.id}`).expect(200),
    );
    expect(smallDone.totals).toMatchObject({ committed: 5, skipped: 0 });
  });

  it('searches by name, ID and guardian phone', async () => {
    const byName = data<StudentRow[]>(
      await admin().get(`/api/students?q=student12 import${runId}`).expect(200),
    );
    expect(byName.map((s) => s.fullName)).toEqual([`Student12 Import${runId}`]);

    const byPhone = data<StudentRow[]>(
      await admin()
        .get(`/api/students?q=${encodeURIComponent(phone(8))}`)
        .expect(200),
    );
    expect(byPhone.map((s) => s.fullName).sort()).toEqual([
      `Student8 Import${runId}`,
      `Student9 Import${runId}`,
    ]);

    const one = byName[0];
    const byId = data<StudentRow[]>(
      await admin().get(`/api/students?q=${one.admissionNumber}`).expect(200),
    );
    expect(byId.map((s) => s.id)).toEqual([one.id]);
  });

  it('transfers between sections with history, and runs the status lifecycle', async () => {
    const [enrollment] = data<Row[]>(
      await admin()
        .get(`/api/enrollments?studentId=${ids.imported}`)
        .expect(200),
    );
    await admin()
      .post(`/api/enrollments/${enrollment.id}/transfer`, {
        sectionId: ids['9A'],
        reason: 'Morning shift',
      })
      .expect(201);
    const history = data<Row[]>(
      await admin()
        .get(`/api/enrollments/${enrollment.id}/transfers`)
        .expect(200),
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromSectionId: ids['9B'],
      toSectionId: ids['9A'],
    });

    await admin()
      .post(`/api/students/${ids.imported}/status`, {
        status: 'left',
        reason: 'Moved away',
      })
      .expect(201);
    const closed = data<Row>(
      await admin().get(`/api/enrollments/${enrollment.id}`).expect(200),
    );
    expect(closed.status).toBe('left');
    await admin()
      .post(`/api/students/${ids.imported}/status`, { status: 'active' })
      .expect(201);
    const reopened = data<Row>(
      await admin().get(`/api/enrollments/${enrollment.id}`).expect(200),
    );
    expect(reopened.status).toBe('active');
    const statusHistory = data<Row[]>(
      await admin()
        .get(`/api/students/${ids.imported}/status-history`)
        .expect(200),
    );
    expect(statusHistory.map((h) => h.toStatus)).toEqual(['active', 'left']);

    // PATCH can't change the status any more.
    await admin()
      .patch(`/api/students/${ids.imported}`, { status: 'graduated' })
      .expect(400);
  });

  it('previews, commits and rolls back a promotion within 24 hours', async () => {
    // Three Class 6 students in section A.
    const sixth: string[] = [];
    for (const name of ['Zara', 'Anik', 'Mita']) {
      const id = await created(
        admin()
          .post('/api/students', {
            classId: ids['Class 6'],
            firstName: name,
            lastName: `Six${runId}`,
          })
          .expect(201),
      );
      await admin()
        .post('/api/enrollments', {
          studentId: id,
          academicYearId: ids.y1,
          classId: ids['Class 6'],
          sectionId: ids['6A'],
          rollNo: String(sixth.length + 1),
        })
        .expect(201);
      sixth.push(id);
    }

    const draft = data<
      Row & {
        summary: Record<string, number>;
        items: (Row & { studentId: string; toSectionId: string | null })[];
      }
    >(
      await admin()
        .post('/api/promotions/batches', {
          fromYearId: ids.y1,
          toYearId: ids.y2,
          classId: ids['Class 6'],
          options: { shuffleSections: true },
        })
        .expect(201),
    );
    expect(draft.summary).toMatchObject({ promote: 3, detain: 0 });
    expect(new Set(draft.items.map((i) => i.toSectionId))).toEqual(
      new Set([ids['next 7A'], ids['next 7B']]),
    );
    // Zara repeats Class 6.
    const zara = draft.items.find((i) => i.studentId === sixth[0])!;
    const detained = data<Row>(
      await admin()
        .patch(`/api/promotions/batches/${draft.id}/items/${zara.id}`, {
          outcome: 'detain',
          note: 'Repeats the year',
        })
        .expect(200),
    );
    expect(detained).toMatchObject({
      outcome: 'detain',
      toSectionId: ids['next 6A'],
      overridden: true,
    });

    const commitJob = data<Row>(
      await admin()
        .post(`/api/promotions/batches/${draft.id}/commit`)
        .expect(202),
    );
    expect((await job(commitJob.id)).result).toEqual({
      promoted: 3,
      graduated: 0,
    });
    const next = data<Row[]>(
      await admin()
        .get(`/api/enrollments?academicYearId=${ids.y2}&limit=100`)
        .expect(200),
    );
    expect(next).toHaveLength(3);
    expect(next.find((n) => n.studentId === sixth[0])?.classId).toBe(
      ids['Class 6'],
    );
    const old = data<Row[]>(
      await admin()
        .get(
          `/api/enrollments?academicYearId=${ids.y1}&classId=${ids['Class 6']}`,
        )
        .expect(200),
    );
    expect(old.map((o) => o.status).sort()).toEqual([
      'completed',
      'promoted',
      'promoted',
    ]);

    const rolledBack = data<Row>(
      await admin()
        .post(`/api/promotions/batches/${draft.id}/rollback`)
        .expect(201),
    );
    expect(rolledBack.status).toBe('rolled_back');
    expect(
      data<Row[]>(
        await admin()
          .get(`/api/enrollments?academicYearId=${ids.y2}`)
          .expect(200),
      ),
    ).toHaveLength(0);
    const reopened = data<Row[]>(
      await admin()
        .get(
          `/api/enrollments?academicYearId=${ids.y1}&classId=${ids['Class 6']}`,
        )
        .expect(200),
    );
    expect(reopened.every((o) => o.status === 'active')).toBe(true);

    // The final class graduates, and that rolls back too.
    const seniors = data<Row & { summary: Record<string, number> }>(
      await admin()
        .post('/api/promotions/batches', {
          fromYearId: ids.y1,
          toYearId: ids.y2,
          classId: ids['Class 10'],
        })
        .expect(201),
    );
    expect(seniors.summary.graduate).toBe(5);
    const seniorsJob = data<Row>(
      await admin()
        .post(`/api/promotions/batches/${seniors.id}/commit`)
        .expect(202),
    );
    expect((await job(seniorsJob.id)).result).toEqual({
      promoted: 0,
      graduated: 5,
    });
    const graduated = data<StudentRow[]>(
      await admin().get(`/api/students?q=senior0 import${runId}`).expect(200),
    );
    expect(graduated[0].status).toBe('graduated');
    await admin()
      .post(`/api/promotions/batches/${seniors.id}/rollback`)
      .expect(201);
    const back = data<StudentRow[]>(
      await admin().get(`/api/students?q=senior0 import${runId}`).expect(200),
    );
    expect(back[0].status).toBe('active');
  });

  it('[tenant-isolation] hides sensitive notes and health without the permission', async () => {
    const student = ids.imported; // in 9A after the transfer
    await admin()
      .post(`/api/students/${student}/notes`, {
        noteType: 'general',
        note: 'Helps classmates',
      })
      .expect(201);
    await admin()
      .post(`/api/students/${student}/notes`, {
        noteType: 'disciplinary',
        note: 'Fight on 3 May',
      })
      .expect(201);
    await admin()
      .put(`/api/students/${student}/medical-record`, { allergies: 'Peanuts' })
      .expect(200);
    const [stored] = await e.rootDs.query<{ allergies: string }[]>(
      'SELECT allergies FROM student_medical_records WHERE student_id = $1',
      [student],
    );
    expect(stored.allergies).toMatch(/^v1:/);

    // A teacher: class teacher of 9A, the plain `teacher` role.
    const roles = data<{ id: string; name: string }[]>(
      await admin().get('/api/roles?limit=100').expect(200),
    );
    const employee = await created(
      admin()
        .post('/api/employees', {
          firstName: 'Nasrin',
          lastName: 'Teacher',
          phone: phone(950),
        })
        .expect(201),
    );
    await admin()
      .post('/api/class-teachers', {
        sectionId: ids['9A'],
        employeeId: employee,
      })
      .expect(201);
    const invite = data<{ userId: string }>(
      await admin()
        .post(`/api/employees/${employee}/invite`, {
          roleIds: [roles.find((r) => r.name === 'teacher')!.id],
        })
        .expect(201),
    );
    await e.rootDs
      .getRepository(User)
      .update({ id: invite.userId }, { mustChangePassword: false });
    const { sessionId } = await e.app
      .get(SessionService)
      .start(invite.userId, schools.a.org.id);
    teacherToken = e.jwt.sign({
      sub: invite.userId,
      orgId: schools.a.org.id,
      isAdmin: false,
      sid: sessionId,
    });

    const notes = data<Row[]>(
      await teacher().get(`/api/students/${student}/notes`).expect(200),
    );
    expect(notes.map((n) => n.noteType)).toEqual(['general']);
    const forbidden = await teacher()
      .post(`/api/students/${student}/notes`, {
        noteType: 'counselling',
        note: 'x',
      })
      .expect(403);
    expect(error(forbidden).code).toBe('FORBIDDEN');
    await teacher().get(`/api/students/${student}/medical-record`).expect(403);
    const overview = data<{ medical: unknown; notes: { count: number } }>(
      await teacher().get(`/api/students/${student}/overview`).expect(200),
    );
    expect(overview.medical).toBeNull();
    expect(overview.notes.count).toBe(1);

    // The admin sees everything.
    const all = data<{
      medical: { allergies: string };
      notes: { count: number };
    }>(await admin().get(`/api/students/${student}/overview`).expect(200));
    expect(all.medical.allergies).toBe('Peanuts');
    expect(all.notes.count).toBe(2);

    // The teacher reaches only students of the sections they teach.
    const listed = (await teacher().get('/api/students?limit=1').expect(200))
      .body as { meta: { total: number } };
    expect(listed.meta.total).toBe(251); // 250 imported + the transfer
    const senior = data<StudentRow[]>(
      await admin().get(`/api/students?q=senior1 import${runId}`).expect(200),
    )[0];
    await teacher().get(`/api/students/${senior.id}`).expect(404);

    // Another school sees none of it.
    const other = as(schools.b.token, schools.b.org);
    await other.get(`/api/students/${student}`).expect(404);
    await other.get(`/api/students/${student}/overview`).expect(404);
  });

  it('uploads photos and documents, and verifies them', async () => {
    const student = ids.imported;
    const photo = data<{ url: string }>(
      await admin()
        .upload(`/api/students/${student}/photo`)
        .attach('file', PNG, 'me.png')
        .expect(201),
    );
    expect(photo.url).toContain('storage.test');
    const doc = data<Row>(
      await admin()
        .upload(`/api/students/${student}/documents`)
        .field('documentType', 'birth_certificate')
        .field('title', 'Birth certificate')
        .attach('file', PDF, 'birth.pdf')
        .expect(201),
    );
    expect(doc.verificationStatus).toBe('pending');
    const checked = data<Row>(
      await admin()
        .post(`/api/students/${student}/documents/${doc.id}/verify`, {
          status: 'verified',
        })
        .expect(201),
    );
    expect(checked).toMatchObject({ verificationStatus: 'verified' });
    expect(checked.verifiedBy).toBeTruthy();
    await admin()
      .get(`/api/students/${student}/documents/${doc.id}/download`)
      .expect(200);
  });

  it('verifies a certificate by its QR token, and shows a revoked one as revoked', async () => {
    const certificate = data<
      Row & { serial: string; verifyToken: string; data: { verifyUrl: string } }
    >(
      await admin()
        .post(`/api/students/${ids.imported}/certificates`, {
          type: 'tc',
          leavingReason: 'Family moved',
        })
        .expect(201),
    );
    expect(certificate.serial).toMatch(new RegExp(`^CERT-${Y1}-\\d{4}$`));
    expect(certificate.data.verifyUrl).toContain(
      `/verify/${certificate.verifyToken}`,
    );

    const verify = () =>
      e
        .http()
        .get(`/api/public/certificates/verify/${certificate.verifyToken}`)
        .expect(200)
        .then((res) =>
          data<{
            name: string;
            type: string;
            status: string;
            issuedOn: string;
          }>(res),
        );
    expect(await verify()).toEqual({
      name: `Student9 Import${runId}`,
      type: 'tc',
      issuedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
      status: 'valid',
    });

    const pdf = data<Row>(
      await admin().post(`/api/certificates/${certificate.id}/pdf`).expect(202),
    );
    const rendered = await job(pdf.id);
    expect(rendered.status).toBe('succeeded');
    expect(rendered.downloadUrl).toContain('storage.test');

    await admin()
      .post(`/api/certificates/${certificate.id}/revoke`, {
        reason: 'Issued in error',
      })
      .expect(201);
    expect((await verify()).status).toBe('revoked');
    await e
      .http()
      .get('/api/public/certificates/verify/not-a-token')
      .expect(404);

    const cards = data<Row>(
      await admin().post(`/api/sections/${ids['9A']}/id-cards`).expect(202),
    );
    const printed = await job(cards.id);
    expect(printed.status).toBe('succeeded');
    expect(printed.result).toEqual({ cards: 251 });
  });

  it('serves the address pickers and keeps addresses consistent', async () => {
    const divisions = data<{ id: number; name: string }[]>(
      await e.http().get('/api/public/geo/divisions').expect(200),
    );
    expect(divisions).toHaveLength(8);
    const dhaka = divisions.find((d) => d.name === 'Dhaka')!;
    const [district] = data<{ id: number }[]>(
      await e
        .http()
        .get(`/api/public/geo/divisions/${dhaka.id}/districts`)
        .expect(200),
    );
    const [upazila] = data<{ id: number }[]>(
      await e
        .http()
        .get(`/api/public/geo/districts/${district.id}/upazilas`)
        .expect(200),
    );
    const address = data<Row>(
      await admin()
        .post(`/api/students/${ids.imported}/addresses`, {
          addressType: 'present',
          addressLine1: 'House 1',
          upazilaId: upazila.id,
        })
        .expect(201),
    );
    expect(address).toMatchObject({
      upazilaId: upazila.id,
      districtId: district.id,
      divisionId: dhaka.id,
    });
  });

  it('imports the staff directory', async () => {
    await admin().post('/api/departments', { name: 'Science' }).expect(201);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Staff');
    ws.addRow([
      'First name',
      'Last name',
      'Phone',
      'Department',
      'Employment type',
    ]);
    ws.addRow(['Ayesha', 'Rahman', phone(960), 'Science', 'permanent']);
    ws.addRow(['Kamal', 'Hossain', phone(961), 'Science', 'contract']);
    const started = data<{ import: Row; job: Row }>(
      await admin()
        .upload('/api/imports')
        .field('type', 'staff')
        .attach('file', Buffer.from(await wb.xlsx.writeBuffer()), 'staff.xlsx')
        .expect(202),
    );
    await job(started.job.id);
    const commit = data<Row>(
      await admin()
        .post(`/api/imports/${started.import.id}/commit`)
        .expect(202),
    );
    expect((await job(commit.id)).status).toBe('succeeded');
    const staff = data<Row[]>(
      await admin().get('/api/employees?limit=100').expect(200),
    );
    expect(
      staff.filter((s) => ['Ayesha', 'Kamal'].includes(s.firstName as string)),
    ).toHaveLength(2);
  });
});
