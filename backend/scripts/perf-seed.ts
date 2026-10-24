/**
 * Performance seed (backend plan M8): builds a 5,000-student school and
 * measures the Phase 1a performance targets against it.
 *
 *   npm run perf:seed                  # seed a fresh school, then measure
 *   npm run perf:seed -- --measure-only  # measure the school seeded last time
 *   npm run perf:seed -- --report-only   # exit 0 even if a target is missed
 *
 * Seeded (school slug `perf-school`; a full run deletes the previous one):
 * classes 1–10 with sections A–J of 50 students (5,000 students, imported
 * through the real Excel importer with a father each, so 5,000 guardians
 * with portal accounts), ~200 school days of attendance (1M records,
 * inserted in SQL through the root connection), one exam with 6 subjects
 * for every class (marks entered, submitted and approved through the API,
 * tabulated by the real job), and a month of fees (invoices from the
 * billing job, payments for 40% of the students through the API).
 *
 * Measured (targets from PRD/backend plan): the admin, teacher and
 * accountant dashboards (< 2 s, cold = cache miss, and warm), saving one
 * section's attendance (50 records, < 1 s), and 500 report cards through
 * the real PDF job (< 2 min). Exits 1 when a target is missed.
 *
 * Environment: `.env.development` plus the shell, as in e2e. The database
 * is `PERF_DB_NAME` (default `school_erp_perf`, created if missing, schema
 * by `DB_SYNC=true`); the tenant pool connects as `DB_APP_USERNAME`
 * (default `school_erp_app`) so row-level security applies, as in
 * production. Storage is in memory, mail is captured, jobs run in-process,
 * and PDFs need a local Chrome (puppeteer; `PDF_CHROME_PATH`, sandbox off).
 * Example against a local Postgres on 5434:
 *
 *   DB_HOST=127.0.0.1 DB_PORT=5434 DB_USERNAME=postgres DB_PASSWORD=x \
 *     npm run perf:seed
 */
import './perf-seed.env';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { CacheStore } from '~/shared/cache';
import { addDays, localDate } from '~/shared/dates/local-date';
import { MailService } from '~/shared/mail/mail.service';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { StorageService } from '~/shared/storage/storage.service';
import { SessionService } from '~/modules/auth/services/session.service';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { MailCapture } from '../test/support/app';
import { MemoryStorage } from '../test/support/storage';

const SLUG = 'perf-school';
const OWNER_EMAIL = 'perf-owner@perf.test';
const TEACHER_EMAIL = 'perf-teacher@perf.test';
const CLASSES = 10;
const SECTIONS = 'ABCDEFGHIJ'.split('');
const PER_SECTION = 50;
const SCHOOL_DAYS = 200;
const SUBJECTS: {
  name: string;
  parts: { component: string; fullMarks: number; passMarks?: number }[];
}[] = [
  { name: 'Bangla', parts: [{ component: 'written', fullMarks: 100 }] },
  { name: 'English', parts: [{ component: 'written', fullMarks: 100 }] },
  { name: 'Mathematics', parts: [{ component: 'written', fullMarks: 100 }] },
  {
    name: 'Science',
    parts: [
      { component: 'cq', fullMarks: 70, passMarks: 23 },
      { component: 'mcq', fullMarks: 30, passMarks: 10 },
    ],
  },
  { name: 'Social Science', parts: [{ component: 'written', fullMarks: 100 }] },
  { name: 'Religion', parts: [{ component: 'written', fullMarks: 100 }] },
];
const TUITION = 150_000; // minor units (1,500 BDT)
const PAYING_SHARE = 0.4;
const CONCURRENCY = 8;
const TARGETS = {
  dashboardMs: 2_000,
  attendanceMs: 1_000,
  reportCardsMs: 120_000,
};

const args = new Set(process.argv.slice(2));
const measureOnly = args.has('--measure-only');
const reportOnly = args.has('--report-only');

interface Row {
  id: string;
  [key: string]: unknown;
}
interface JobView {
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
}
interface Ctx {
  app: INestApplication;
  root: DataSource;
  base: string;
  orgId: string;
  admin: string;
  teacher: string;
  teacherUserId: string;
}

// ---------------------------------------------------------------- helpers

const log = (msg: string) => console.log(`[perf] ${msg}`);
const ms = (n: number) => `${Math.round(n).toLocaleString('en-US')} ms`;

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  const out = await fn();
  log(`${label}: ${ms(performance.now() - t)}`);
  return out;
}

/** Runs `fn` over `items`, `n` at a time. */
async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/** Deterministic pseudo-random numbers, so runs are comparable. */
let rngState = 42;
const rand = () => {
  // mulberry32
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};

class Api {
  constructor(
    private readonly base: string,
    private readonly slug: string,
  ) {}

  async call<T = unknown>(
    token: string,
    method: string,
    path: string,
    body?: unknown,
    expect?: number,
  ): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${this.base}/api${path}`, {
      method,
      headers: {
        'x-tenant-id': this.slug,
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && !isForm
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok || (expect !== undefined && res.status !== expect)) {
      throw new Error(
        `${method} ${path} → ${res.status}: ${text.slice(0, 500)}`,
      );
    }
    const json = text
      ? (JSON.parse(text) as { data: T })
      : { data: undefined as T };
    return json.data;
  }

  /** Raw bytes of a GET (spreadsheet templates). */
  async bytes(token: string, path: string): Promise<ArrayBuffer> {
    const res = await fetch(`${this.base}/api${path}`, {
      headers: { 'x-tenant-id': this.slug, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.arrayBuffer();
  }
}

let api: Api;
const get = <T>(token: string, path: string) => api.call<T>(token, 'GET', path);
const post = <T = Row>(token: string, path: string, body: unknown = {}) =>
  api.call<T>(token, 'POST', path, body);
const put = <T = Row>(token: string, path: string, body: unknown) =>
  api.call<T>(token, 'PUT', path, body);

async function drain(app: INestApplication) {
  await app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
}

async function job(ctx: Ctx, id: string): Promise<JobView> {
  await drain(ctx.app);
  const view = await get<JobView>(ctx.admin, `/jobs/${id}`);
  if (view.status !== 'succeeded') {
    throw new Error(`Job ${id} ${view.status}: ${view.error ?? ''}`);
  }
  return view;
}

// ------------------------------------------------------------------- boot

async function ensureDatabase() {
  const admin = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.initialize();
  try {
    const name = process.env.DB_NAME!;
    const rows: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (!rows.length) {
      await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      log(`created database ${name}`);
    }
  } finally {
    await admin.destroy();
  }
}

async function boot() {
  const mail = new MailCapture();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail.service)
    .overrideProvider(StorageService)
    .useValue(new MemoryStorage())
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as { address(): AddressInfo };
  const { port } = server.address();
  return {
    app,
    root: app.get<DataSource>(getDataSourceToken()),
    base: `http://127.0.0.1:${port}`,
  };
}

async function tokenFor(
  app: INestApplication,
  userId: string,
  orgId: string,
  isAdmin: boolean,
) {
  const { sessionId } = await app.get(SessionService).start(userId, orgId);
  return new JwtService({ secret: process.env.JWT_SECRET }).sign({
    sub: userId,
    orgId,
    isAdmin,
    sid: sessionId,
  });
}

// ------------------------------------------------------------------- seed

/** Deletes the previous perf school and the accounts that only it used. */
async function cleanup(root: DataSource) {
  const [org] = await root.query<{ id: string }[]>(
    'SELECT id FROM organizations WHERE slug = $1',
    [SLUG],
  );
  if (org) {
    await timed('delete previous perf school', async () => {
      await root.query(
        `DELETE FROM users u WHERE u.id IN (SELECT user_id FROM memberships WHERE org_id = $1)
           AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.org_id <> $1)`,
        [org.id],
      );
      await root.query('DELETE FROM organizations WHERE id = $1', [org.id]);
    });
  }
  await root.query(`DELETE FROM users WHERE email LIKE '%@perf.test'`);
}

/** The school days to fill: the last ones up to `until`, skipping Fridays and holidays. */
function schoolDays(
  until: string,
  from: string,
  holidays: { from: string; to: string }[],
  count: number,
) {
  const days: string[] = [];
  for (let d = until; d >= from && days.length < count; d = addDays(d, -1)) {
    const friday = new Date(`${d}T00:00:00Z`).getUTCDay() === 5;
    if (!friday && !holidays.some((h) => d >= h.from && d <= h.to))
      days.push(d);
  }
  return days.reverse();
}

async function seed(
  app: INestApplication,
  root: DataSource,
  base: string,
): Promise<Ctx> {
  await cleanup(root);
  const today = localDate('Asia/Dhaka');
  const yearStart = addDays(today, -300);
  const yearEnd = addDays(yearStart, 364);

  // School and owner.
  const users = root.getRepository(User);
  const owner = await users.save(
    users.create({
      email: OWNER_EMAIL,
      name: 'Perf Owner',
      password: 'not-used',
      status: UserStatus.ACTIVE,
    }),
  );
  const org = await root.transaction((manager) =>
    app.get(OrganizationService).createForSignup(manager, {
      name: 'Performance School',
      slug: SLUG,
      type: OrganizationType.SCHOOL,
      ownerUserId: owner.id,
    }),
  );
  api = new Api(base, SLUG);
  const admin = await tokenFor(app, owner.id, org.id, true);
  const ctx: Ctx = {
    app,
    root,
    base,
    orgId: org.id,
    admin,
    teacher: '',
    teacherUserId: '',
  };

  // Structure.
  const ids: Record<string, string> = {};
  const classIds: string[] = [];
  const sectionIds: Record<string, string> = {}; // `${class}:${section}`
  const classSubjects: Record<string, string[]> = {}; // class → class subject ids
  await timed('academic structure', async () => {
    ids.year = (
      await post(admin, '/academic-years', {
        name: `Perf ${yearStart.slice(0, 4)}`,
        startDate: yearStart,
        endDate: yearEnd,
        isCurrent: true,
      })
    ).id;
    for (const y of new Set([yearStart.slice(0, 4), yearEnd.slice(0, 4)])) {
      await post(admin, '/onboarding/templates/holidays/bd/apply', {
        year: Number(y),
      });
    }
    await post(admin, '/grading-systems/templates/bd-gpa-5');
    await post(admin, '/onboarding/templates/fee-heads/apply');
    const subjectIds = await pool(
      SUBJECTS,
      1,
      async (s) => (await post(admin, '/subjects', { name: s.name })).id,
    );
    for (let c = 1; c <= CLASSES; c++) {
      const classId = (
        await post(admin, '/classes', { name: `Class ${c}`, level: c })
      ).id;
      classIds.push(classId);
      await pool(SECTIONS, CONCURRENCY, async (name) => {
        sectionIds[`${c}:${name}`] = (
          await post(admin, '/sections', {
            academicYearId: ids.year,
            classId,
            name,
          })
        ).id;
      });
      classSubjects[c] = await pool(SUBJECTS, CONCURRENCY, async (s, i) => {
        const id = (
          await post(admin, '/class-subjects', {
            classId,
            subjectId: subjectIds[i],
            academicYearId: ids.year,
            subjectType: 'compulsory',
          })
        ).id;
        for (const part of s.parts)
          await post(admin, `/class-subjects/${id}/components`, part);
        return id;
      });
    }
  });

  // Staff: 40 employees, one teacher who signs in (class teacher of 10A,
  // teaches Mathematics in every class 10 section and Science in class 9).
  await timed('staff', async () => {
    const roles = await get<{ id: string; name: string }[]>(
      admin,
      '/roles?limit=100',
    );
    const roleId = (name: string) => roles.find((r) => r.name === name)!.id;
    const employees = await pool(
      Array.from({ length: 40 }, (_, i) => i),
      CONCURRENCY,
      async (i) =>
        (
          await post(admin, '/employees', {
            firstName: `Staff${i}`,
            lastName: 'Perf',
            ...(i === 0
              ? { email: TEACHER_EMAIL }
              : { phone: `0171${String(9_000_000 + i).padStart(7, '0')}` }),
          })
        ).id,
    );
    const teacherEmployee = employees[0];
    await post(admin, '/class-teachers', {
      sectionId: sectionIds['10:A'],
      employeeId: teacherEmployee,
    });
    for (const s of SECTIONS) {
      await post(admin, '/subject-teachers', {
        sectionId: sectionIds[`10:${s}`],
        classSubjectId: classSubjects[10][2],
        employeeId: teacherEmployee,
      });
      await post(admin, '/subject-teachers', {
        sectionId: sectionIds[`9:${s}`],
        classSubjectId: classSubjects[9][3],
        employeeId: teacherEmployee,
      });
    }
    const invite = await post<{ userId: string }>(
      admin,
      `/employees/${teacherEmployee}/invite`,
      {
        roleIds: [roleId('teacher'), roleId('class_teacher')],
      },
    );
    await users.update({ id: invite.userId }, { mustChangePassword: false });
    ctx.teacherUserId = invite.userId;
    ctx.teacher = await tokenFor(app, invite.userId, org.id, false);
  });

  // Students through the Excel importer, one file of 500 per class.
  await timed(
    `import ${CLASSES * SECTIONS.length * PER_SECTION} students`,
    async () => {
      const template = await api.bytes(admin, '/imports/templates/students');
      for (let c = 1; c <= CLASSES; c++) {
        const t = performance.now();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(template);
        const ws = wb.worksheets[0];
        const headers = (ws.getRow(1).values as (string | undefined)[]).map(
          (v) => (v ?? '').replace(/ \*$/, ''),
        );
        let next = 2;
        for (let i = 0; i < SECTIONS.length * PER_SECTION; i++) {
          const n = (c - 1) * 1000 + i;
          // Every 20th student is the sibling of the one before.
          const father = i % 20 === 19 ? n - 1 : n;
          const values: Record<string, string | number> = {
            'First name': `Student${n}`,
            'Last name': 'Perf',
            Gender: i % 2 ? 'female' : 'male',
            'Date of birth': `${2020 - c}-0${(i % 9) + 1}-15`,
            Class: `Class ${c}`,
            Section: SECTIONS[i % SECTIONS.length],
            Roll: Math.floor(i / SECTIONS.length) + 1,
            'Father name': `Father ${father}`,
            'Father phone': `01${3 + (father % 7)}${String(father).padStart(8, '0')}`,
          };
          const row = ws.getRow(next++);
          headers.forEach((h, k) => {
            if (k > 0) row.getCell(k).value = values[h] ?? null;
          });
          row.commit();
        }
        const form = new FormData();
        form.append('type', 'students');
        form.append('mode', 'all_or_nothing');
        form.append(
          'file',
          new Blob([Buffer.from(await wb.xlsx.writeBuffer())], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `class-${c}.xlsx`,
        );
        const started = await api.call<{ import: Row; job: Row }>(
          admin,
          'POST',
          '/imports',
          form,
          202,
        );
        await job(ctx, started.job.id);
        const preview = await get<{
          status: string;
          totals: { valid: number; invalid: number };
        }>(admin, `/imports/${started.import.id}`);
        if (preview.totals.invalid)
          throw new Error(`Import class ${c}: ${JSON.stringify(preview)}`);
        await job(
          ctx,
          (await post(admin, `/imports/${started.import.id}/commit`)).id,
        );
        log(
          `  class ${c}: ${preview.totals.valid} students in ${ms(performance.now() - t)}`,
        );
      }
    },
  );

  // A year of attendance in SQL (registers + records), up to today; the
  // teacher's own section is left open today for the save measurement.
  await timed('attendance history (SQL)', async () => {
    const holidays = (
      await root.query<{ from: string; to: string }[]>(
        `SELECT to_char(date_from, 'YYYY-MM-DD') AS "from", to_char(date_to, 'YYYY-MM-DD') AS "to"
           FROM holidays WHERE org_id = $1 AND cardinality(class_ids) = 0`,
        [org.id],
      )
    ).map((h) => ({ from: h.from, to: h.to }));
    const days = schoolDays(today, yearStart, holidays, SCHOOL_DAYS);
    log(`  ${days.length} school days, ${days[0]} → ${days[days.length - 1]}`);
    await root.query(
      `INSERT INTO attendance_registers (id, org_id, section_id, date, period_id, taken_by, submitted_at)
       SELECT gen_random_uuid(), s.org_id, s.id, d, NULL, $3, d + time '09:30'
         FROM sections s CROSS JOIN unnest($2::date[]) AS d
        WHERE s.org_id = $1 AND NOT (s.id = $4 AND d = $5::date)`,
      [org.id, days, owner.id, sectionIds['10:A'], today],
    );
    await root.query(
      `INSERT INTO attendance_records (id, org_id, register_id, enrollment_id, status_code, updated_by)
       SELECT gen_random_uuid(), r.org_id, r.id, e.id,
              CASE WHEN x < 0.88 THEN 'present' WHEN x < 0.94 THEN 'absent'
                   WHEN x < 0.98 THEN 'late' WHEN x < 0.99 THEN 'leave' ELSE 'half_day' END,
              $2
         FROM attendance_registers r
         JOIN student_enrollments e ON e.org_id = r.org_id AND e.section_id = r.section_id
         CROSS JOIN LATERAL (SELECT random() + 0 * length(e.id::text) AS x) rnd
        WHERE r.org_id = $1`,
      [org.id, owner.id],
    );
  });

  // One exam for every class: marks, submit, approve, tabulate.
  await timed('exam cycle', async () => {
    const examId = (
      await post(admin, '/exams', {
        academicYearId: ids.year,
        name: 'Half-yearly',
      })
    ).id;
    await post(admin, `/exams/${examId}/subjects`, { classIds });
    await post(admin, `/exams/${examId}/open`);
    const sheets = await get<Row[]>(admin, `/exams/${examId}/mark-sheets`);
    log(`  ${sheets.length} mark sheets`);
    await timed('  marks entered and submitted', () =>
      pool(sheets, CONCURRENCY, async (sheet) => {
        const grid = await get<{
          subject: { components: { id: string; fullMarks: number }[] };
          students: { enrollmentId: string }[];
        }>(admin, `/mark-sheets/${sheet.id}/marks`);
        const entries = grid.students.flatMap((s) =>
          grid.subject.components.map((c) =>
            rand() < 0.01
              ? {
                  enrollmentId: s.enrollmentId,
                  componentId: c.id,
                  absent: true,
                }
              : {
                  enrollmentId: s.enrollmentId,
                  componentId: c.id,
                  value: Math.round(c.fullMarks * (0.25 + rand() * 0.75)),
                },
          ),
        );
        await put(admin, `/mark-sheets/${sheet.id}/marks`, { entries });
        await post(admin, `/mark-sheets/${sheet.id}/submit`);
      }),
    );
    await timed('  approved and tabulated', async () => {
      for (let i = 0; i < sheets.length; i += 500) {
        await post(admin, '/mark-sheets/approve', {
          markSheetIds: sheets.slice(i, i + 500).map((s) => s.id),
        });
      }
      await drain(app);
    });
    const definitions = await get<{ status: { current: boolean } }[]>(
      admin,
      `/result-definitions?examId=${examId}`,
    );
    if (
      definitions.length !== CLASSES ||
      !definitions.every((d) => d.status.current)
    ) {
      throw new Error(
        `Tabulation incomplete: ${JSON.stringify(definitions.map((d) => d.status))}`,
      );
    }
  });

  // A month of fees: structures, the billing job, 40% paying tuition.
  await timed('fees', async () => {
    const period = today.slice(0, 7);
    const heads = await get<{ id: string; name: string }[]>(
      admin,
      '/fee-heads',
    );
    const head = (name: string) => heads.find((h) => h.name === name)!.id;
    for (let c = 1; c <= CLASSES; c++) {
      await post(admin, '/fee-structures', {
        name: `Class ${c}`,
        academicYearId: ids.year,
        classId: classIds[c - 1],
        items: [
          { feeHeadId: head('Tuition Fee'), amount: TUITION + c * 10_000 },
          {
            feeHeadId: head('Exam Fee'),
            amount: 50_000,
            months: [Number(period.slice(5))],
          },
        ],
      });
    }
    const run = await timed('  invoices generated', async () =>
      job(ctx, (await post(admin, '/invoices/generate', { period })).id),
    );
    log(`  ${JSON.stringify(run.result)}`);
    const students = await root.query<{ id: string }[]>(
      'SELECT id FROM students WHERE org_id = $1 AND deleted_at IS NULL ORDER BY admission_number',
      [org.id],
    );
    const paying = students.filter(() => rand() < PAYING_SHARE);
    await timed(`  ${paying.length} payments`, () =>
      pool(paying, CONCURRENCY, (s) =>
        post(admin, '/payments', {
          studentId: s.id,
          channel: 'cash',
          amount: TUITION,
        }),
      ),
    );
  });

  await timed('ANALYZE', () => root.query('ANALYZE'));
  return ctx;
}

/** The school seeded by an earlier run. */
async function reuse(
  app: INestApplication,
  root: DataSource,
  base: string,
): Promise<Ctx> {
  const [row] = await root.query<
    { org: string; owner: string; teacher: string }[]
  >(
    `SELECT o.id AS org,
            (SELECT id FROM users WHERE email = $2) AS owner,
            (SELECT id FROM users WHERE email = $3) AS teacher
       FROM organizations o WHERE o.slug = $1`,
    [SLUG, OWNER_EMAIL, TEACHER_EMAIL],
  );
  if (!row?.owner || !row.teacher)
    throw new Error('No perf school yet: run without --measure-only first');
  api = new Api(base, SLUG);
  return {
    app,
    root,
    base,
    orgId: row.org,
    admin: await tokenFor(app, row.owner, row.org, true),
    teacher: await tokenFor(app, row.teacher, row.org, false),
    teacherUserId: row.teacher,
  };
}

// ---------------------------------------------------------------- measure

interface Measurement {
  name: string;
  target: number;
  values: number[];
  /** Which value is held against the target. */
  judged: number;
  note?: string;
}

async function measure(ctx: Ctx): Promise<Measurement[]> {
  const out: Measurement[] = [];
  const cache = ctx.app.get(CacheStore);
  const clock = async (fn: () => Promise<unknown>) => {
    const t = performance.now();
    await fn();
    return performance.now() - t;
  };

  // Dashboards: first call after boot, then 3 cache misses and 3 hits.
  for (const [name, token, key] of [
    ['admin', ctx.admin, `dash:admin:${ctx.orgId}`],
    ['teacher', ctx.teacher, `dash:teacher:${ctx.orgId}:${ctx.teacherUserId}`],
    ['accountant', ctx.admin, `dash:accountant:${ctx.orgId}`],
  ] as const) {
    const call = () => get(token, `/dashboards/${name}`);
    const cold: number[] = [];
    for (let i = 0; i < 4; i++) {
      await cache.del(key);
      cold.push(await clock(call));
    }
    const warm: number[] = [];
    for (let i = 0; i < 3; i++) warm.push(await clock(call));
    out.push({
      name: `dashboard ${name} (cold)`,
      target: TARGETS.dashboardMs,
      values: cold,
      judged: Math.max(...cold),
      note: 'first after boot, then 3 cache misses',
    });
    out.push({
      name: `dashboard ${name} (warm)`,
      target: TARGETS.dashboardMs,
      values: warm,
      judged: Math.max(...warm),
    });
  }

  // Attendance: the class teacher saves 10A today (50 records), 3 times on
  // a fresh register.
  const [section] = await ctx.root.query<{ id: string }[]>(
    `SELECT s.id FROM sections s JOIN classes c ON c.id = s.class_id
       JOIN academic_years y ON y.id = s.academic_year_id AND y.is_current
      WHERE s.org_id = $1 AND c.name = 'Class 10' AND s.name = 'A'`,
    [ctx.orgId],
  );
  const today = localDate('Asia/Dhaka');
  const path = `/attendance/sections/${section.id}?date=${today}`;
  const saves: number[] = [];
  let note: string | undefined;
  const roster = await get<{
    dayOff: unknown;
    students: { enrollmentId: string }[];
  }>(ctx.teacher, path);
  if (roster.dayOff) {
    note = `skipped: ${today} is a day off (${JSON.stringify(roster.dayOff)})`;
  } else {
    const records = roster.students.map((s, i) => ({
      enrollmentId: s.enrollmentId,
      status: i % 12 === 0 ? 'absent' : i % 17 === 0 ? 'late' : 'present',
    }));
    for (let i = 0; i < 3; i++) {
      await ctx.root.query(
        `DELETE FROM attendance_registers WHERE org_id = $1 AND section_id = $2 AND date = $3 AND period_id IS NULL`,
        [ctx.orgId, section.id, today],
      );
      saves.push(await clock(() => put(ctx.teacher, path, { records })));
    }
    note = `${records.length} records, new register each time`;
  }
  out.push({
    name: 'attendance save (one section)',
    target: TARGETS.attendanceMs,
    values: saves,
    judged: saves.length ? Math.max(...saves) : NaN,
    note,
  });

  // Report cards: every section of class 10 (10 jobs × 50 = 500 cards).
  const [definition] = await ctx.root.query<{ id: string; class_id: string }[]>(
    `SELECT d.id, d.class_id FROM result_definitions d JOIN classes c ON c.id = d.class_id
      WHERE d.org_id = $1 AND c.name = 'Class 10' AND d.exam_id IS NOT NULL`,
    [ctx.orgId],
  );
  const sections = await ctx.root.query<{ id: string }[]>(
    `SELECT id FROM sections WHERE org_id = $1 AND class_id = $2 ORDER BY name`,
    [ctx.orgId, definition.class_id],
  );
  let cards = 0;
  const t = performance.now();
  const jobs = await Promise.all(
    sections.map((s) =>
      post(ctx.admin, `/result-definitions/${definition.id}/report-cards`, {
        sectionId: s.id,
        language: 'bn',
      }),
    ),
  );
  await drain(ctx.app);
  for (const j of jobs)
    cards += Number((await job(ctx, j.id)).result?.cards ?? 0);
  const elapsed = performance.now() - t;
  out.push({
    name: `report cards (${cards})`,
    target: TARGETS.reportCardsMs,
    values: [elapsed],
    judged: elapsed,
    note: `${sections.length} section jobs in parallel, PDF_CONCURRENCY=${process.env.PDF_CONCURRENCY ?? 4}`,
  });
  return out;
}

async function volumes(root: DataSource, orgId: string) {
  const tables = [
    'students',
    'student_enrollments',
    'guardians',
    'employees',
    'attendance_registers',
    'attendance_records',
    'mark_sheets',
    'marks',
    'results',
    'invoices',
    'invoice_lines',
    'payments',
  ];
  const rows: [string, number][] = [];
  for (const table of tables) {
    try {
      const [r] = await root.query<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM ${table} WHERE org_id = $1`,
        [orgId],
      );
      rows.push([table, r.n]);
    } catch {
      // A table under another name: skip it.
    }
  }
  return rows;
}

function print(rows: Measurement[]) {
  const pad = (s: string, n: number) => s.padEnd(n);
  const lines = [
    `${pad('check', 34)}${pad('target', 12)}${pad('judged', 12)}${pad('runs', 40)}result`,
    '-'.repeat(106),
    ...rows.map((r) => {
      const pass = Number.isNaN(r.judged)
        ? 'SKIP'
        : r.judged <= r.target
          ? 'PASS'
          : 'FAIL';
      return `${pad(r.name, 34)}${pad(ms(r.target), 12)}${pad(Number.isNaN(r.judged) ? '-' : ms(r.judged), 12)}${pad(
        r.values.map((v) => Math.round(v)).join(' / '),
        40,
      )}${pass}${r.note ? `  (${r.note})` : ''}`;
    }),
  ];
  console.log(`\n${lines.join('\n')}\n`);
}

async function main() {
  await ensureDatabase();
  const { app, root, base } = await timed('boot', boot);
  let failed = false;
  try {
    const ctx = measureOnly
      ? await reuse(app, root, base)
      : await timed('seed total', () => seed(app, root, base));
    console.log('\nSeeded volumes:');
    for (const [table, n] of await volumes(root, ctx.orgId))
      console.log(`  ${table.padEnd(24)}${n.toLocaleString('en-US')}`);
    const results = await measure(ctx);
    print(results);
    failed = results.some(
      (r) => !Number.isNaN(r.judged) && r.judged > r.target,
    );
  } finally {
    await app.close();
  }
  if (failed && !reportOnly) {
    console.error('[perf] a target was missed');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
