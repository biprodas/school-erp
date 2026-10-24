import { randomInt, randomUUID } from 'crypto';
import { Like } from 'typeorm';
import { localDate } from '~/shared/dates/local-date';
import { InlineJobQueue, JobQueue } from '~/shared/queue';
import { FeeScheduler } from '~/modules/fees/fee.scheduler';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
import { User } from '~/modules/users/entities/user.entity';
import { UserStatus } from '~/modules/users/enums/user-status.enum';
import { SessionService } from '~/modules/auth/services/session.service';
import { bootApp, data, error, type E2eApp } from './support/app';
import { MemoryStorage, withMemoryStorage } from './support/storage';

jest.setTimeout(240_000);

interface Row {
  id: string;
  [key: string]: unknown;
}
interface Line {
  id: string;
  kind: string;
  description: string;
  amount: number;
  discount: number;
  net: number;
  outstanding: number;
}
interface InvoiceView {
  id: string;
  studentId: string;
  status: string;
  netTotal: number;
  outstanding: number;
  dueDate: string;
  lines: Line[];
}
interface ReceiptView {
  id: string;
  number: string;
  status: string;
  cancelReason: string | null;
  allocations: {
    amount: number;
    studentId: string;
    reversedAt: string | null;
  }[];
}
interface JobView {
  status: string;
  result: Record<string, number> | null;
  downloadUrl: string | null;
}

/**
 * M6 acceptance (backend plan 10, PRD 6.10): generation with discounts,
 * oldest-first allocation across children, gap-free receipts under
 * concurrent collection, receipt cancellation (reason, permission, stays
 * visible), the collector's day reconciling to receipts, approved
 * adjustments, late fines, the outstanding invariants, expenses and the
 * ledger, and tenant isolation.
 */
describe('Fees (e2e)', () => {
  let e: E2eApp;
  const storage = new MemoryStorage();
  const runId = randomUUID().slice(0, 8);
  const phoneBase = `01${randomInt(3, 10)}${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
  const phone = (i: number) => `${phoneBase}${String(i).padStart(2, '0')}`;
  const today = localDate('Asia/Dhaka');
  const period = today.slice(0, 7);
  const Y = Number(today.slice(0, 4));

  const schools: Record<'a' | 'b', { org: Organization; token: string }> =
    {} as never;
  let receptionToken: string;
  const ids: Record<string, string> = {};
  const students: Record<string, string> = {};

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
      delete: (url: string) => req('delete', url),
    };
  };
  const admin = () => as(schools.a.token, schools.a.org);
  const reception = () => as(receptionToken, schools.a.org);
  const drain = () => e.app.get<JobQueue, InlineJobQueue>(JobQueue).drain();
  const created = async (res: Promise<{ body: unknown }>) =>
    data<Row>(await res).id;
  const job = async (id: string) => {
    await drain();
    return data<JobView>(await admin().get(`/api/jobs/${id}`).expect(200));
  };
  const statement = async (key: string) =>
    data<{ outstanding: number; collected: number; invoices: InvoiceView[] }>(
      await admin().get(`/api/invoices/statement/${students[key]}`).expect(200),
    );
  /** billed − discounts − adjustments − collected = outstanding, school-wide. */
  const assertInvariant = async () => {
    const demand = data<{
      totals: Record<
        'billed' | 'discounts' | 'adjusted' | 'collected' | 'outstanding',
        number
      >;
    }>(
      await admin()
        .get(`/api/fees/reports/collection-vs-demand?from=${Y}-01&to=${Y}-12`)
        .expect(200),
    ).totals;
    expect(
      demand.billed - demand.discounts - demand.adjusted - demand.collected,
    ).toBe(demand.outstanding);
    let sum = 0;
    for (const key of Object.keys(students))
      sum += (await statement(key)).outstanding;
    expect(sum).toBe(demand.outstanding);
    return demand;
  };

  async function makeSchool(key: 'a' | 'b') {
    const users = e.rootDs.getRepository(User);
    const owner = await users.save(
      users.create({
        email: `m6-${key}-${runId}@e2e.test`,
        name: `Owner ${key}`,
        password: 'not-used',
        status: UserStatus.ACTIVE,
      }),
    );
    const org = await e.rootDs.transaction((manager) =>
      e.app.get(OrganizationService).createForSignup(manager, {
        name: `E2E M6 ${key} ${runId}`,
        slug: `e2e-m6-${key}-${runId}`,
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

  async function enrol(key: string, section: string, roll: string) {
    students[key] = await created(
      admin()
        .post('/api/students', {
          classId: ids.class6,
          firstName: key,
          lastName: 'Student',
        })
        .expect(201),
    );
    await admin()
      .post('/api/enrollments', {
        studentId: students[key],
        academicYearId: ids.year,
        classId: ids.class6,
        sectionId: ids[section],
        rollNo: roll,
      })
      .expect(201);
  }

  beforeAll(async () => {
    e = await bootApp(withMemoryStorage(storage), { PDF_NO_SANDBOX: 'true' });
    await makeSchool('a');
    await makeSchool('b');
    ids.year = await created(
      admin()
        .post('/api/academic-years', {
          name: `${Y}`,
          startDate: `${Y}-01-01`,
          endDate: `${Y}-12-31`,
          isCurrent: true,
        })
        .expect(201),
    );
    ids.class6 = await created(
      admin().post('/api/classes', { name: 'Class 6', level: 6 }).expect(201),
    );
    for (const name of ['A', 'B']) {
      ids[name] = await created(
        admin()
          .post('/api/sections', {
            academicYearId: ids.year,
            classId: ids.class6,
            name,
          })
          .expect(201),
      );
    }
    await enrol('s1', 'A', '1');
    await enrol('s2', 'A', '2');
    await enrol('s3', 'B', '1');
    ids.guardian = await created(
      admin()
        .post('/api/guardians', { name: 'Rahim Uddin', phone: phone(1) })
        .expect(201),
    );
    for (const key of ['s1', 's2']) {
      await admin()
        .post(`/api/students/${students[key]}/guardians`, {
          guardianId: ids.guardian,
          relation: 'father',
          isPrimary: true,
        })
        .expect(201);
    }

    // A receptionist: collects, can't cancel receipts.
    const roles = data<{ id: string; name: string }[]>(
      await admin().get('/api/roles?limit=100').expect(200),
    );
    const employee = await created(
      admin()
        .post('/api/employees', {
          firstName: 'Front',
          lastName: 'Desk',
          phone: phone(2),
        })
        .expect(201),
    );
    const invite = data<{ userId: string }>(
      await admin()
        .post(`/api/employees/${employee}/invite`, {
          roleIds: [roles.find((r) => r.name === 'receptionist')!.id],
        })
        .expect(201),
    );
    await e.rootDs
      .getRepository(User)
      .update({ id: invite.userId }, { mustChangePassword: false });
    const { sessionId } = await e.app
      .get(SessionService)
      .start(invite.userId, schools.a.org.id);
    receptionToken = e.jwt.sign({
      sub: invite.userId,
      orgId: schools.a.org.id,
      isAdmin: false,
      sid: sessionId,
    });
  });

  afterAll(async () => {
    if (e?.rootDs.isInitialized) {
      await e.rootDs
        .getRepository(Organization)
        .delete({ slug: Like(`e2e-m6-%-${runId}`) });
      await e.rootDs
        .getRepository(User)
        .delete({ email: Like(`m6-%-${runId}@e2e.test`) });
      await e.rootDs.query(`DELETE FROM users WHERE phone LIKE $1`, [
        `+880${phoneBase.slice(1)}%`,
      ]);
    }
    await e?.close();
  });

  it('sets up heads, a structure and an approved sibling discount', async () => {
    const applied = data<{ created: number }>(
      await admin()
        .post('/api/onboarding/templates/fee-heads/apply')
        .expect(200),
    );
    expect(applied.created).toBe(10);
    const heads = data<{ id: string; name: string }[]>(
      await admin().get('/api/fee-heads').expect(200),
    );
    ids.tuition = heads.find((h) => h.name === 'Tuition Fee')!.id;
    ids.exam = heads.find((h) => h.name === 'Exam Fee')!.id;
    await admin()
      .post('/api/fee-structures', {
        name: 'Class 6',
        academicYearId: ids.year,
        classId: ids.class6,
        items: [
          { feeHeadId: ids.tuition, amount: 150_000 },
          {
            feeHeadId: ids.exam,
            amount: 50_000,
            months: [Number(period.slice(5))],
          },
        ],
      })
      .expect(201);
    ids.sibling = await created(
      admin()
        .post('/api/discount-types', {
          name: 'Sibling',
          code: 'sibling',
          kind: 'percent',
          value: 2500,
          appliesToHeadIds: [ids.tuition],
        })
        .expect(201),
    );
    const discount = await created(
      admin()
        .post('/api/student-discounts', {
          studentId: students.s2,
          discountTypeId: ids.sibling,
          fromPeriod: `${Y}-01`,
        })
        .expect(201),
    );
    await admin()
      .post(`/api/student-discounts/${discount}/approve`)
      .expect(200);
  });

  it('generates the month’s invoices once, with the discount', async () => {
    const run = data<Row>(
      await admin().post('/api/invoices/generate', { period }).expect(202),
    );
    expect((await job(run.id)).result).toMatchObject({
      students: 3,
      invoicesCreated: 3,
      linesCreated: 6,
    });
    const s2 = (await statement('s2')).invoices[0];
    const tuition = s2.lines.find((l) => l.description === 'Tuition Fee')!;
    expect(tuition).toMatchObject({
      amount: 150_000,
      discount: 37_500,
      net: 112_500,
    });
    expect(s2.netTotal).toBe(162_500);

    const again = data<Row>(
      await admin().post('/api/invoices/generate', { period }).expect(202),
    );
    expect((await job(again.id)).result).toMatchObject({
      invoicesCreated: 0,
      linesCreated: 0,
    });
    await assertInvariant();
  });

  it('settles a guardian’s two children oldest first, refusing over-allocation', async () => {
    const tooMuch = await reception()
      .post('/api/payments', {
        guardianId: ids.guardian,
        channel: 'cash',
        amount: 400_000,
      })
      .expect(400);
    expect(error(tooMuch).code).toBe('PAYMENT_EXCEEDS_DUE');
    const line = (await statement('s1')).invoices[0].lines[0];
    const overLine = await reception()
      .post('/api/payments', {
        studentId: students.s1,
        channel: 'cash',
        amount: line.net + 1,
        allocations: [{ invoiceLineId: line.id, amount: line.net + 1 }],
      })
      .expect(400);
    expect(error(overLine).code).toBe('ALLOCATION_EXCEEDS_LINE');

    // s1 owes 200 000, s2 162 500: pay 300 000.
    const receipt = data<ReceiptView>(
      await reception()
        .post('/api/payments', {
          guardianId: ids.guardian,
          channel: 'cash',
          amount: 300_000,
        })
        .set('Idempotency-Key', randomUUID())
        .expect(201),
    );
    expect(receipt.number).toMatch(new RegExp(`^RCP-${Y}-\\d{6}$`));
    expect(receipt.allocations.reduce((n, a) => n + a.amount, 0)).toBe(300_000);
    expect(
      (await statement('s1')).outstanding + (await statement('s2')).outstanding,
    ).toBe(62_500);
    ids.guardianReceipt = receipt.id;
    await assertInvariant();
  });

  it('keeps receipt numbers gap-free under concurrent collection', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        admin().post('/api/payments', {
          studentId: students.s3,
          channel: 'cash',
          amount: 10_000,
        }),
      ),
    );
    for (const r of results) expect(r.status).toBe(201);
    const numbers = results
      .map((r) => Number(data<ReceiptView>(r).number.slice(-6)))
      .sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(10);
    expect(numbers[9] - numbers[0]).toBe(9);
    expect(numbers[0]).toBe(2);
    expect((await statement('s3')).outstanding).toBe(100_000);
    await assertInvariant();
  });

  it('cancels a receipt only with a reason and the permission, and keeps it visible', async () => {
    const id = ids.guardianReceipt;
    await reception()
      .post(`/api/receipts/${id}/cancel`, { reason: 'Wrong payer' })
      .expect(403);
    await admin().post(`/api/receipts/${id}/cancel`, {}).expect(400);
    const cancelled = data<ReceiptView>(
      await admin()
        .post(`/api/receipts/${id}/cancel`, { reason: 'Wrong payer' })
        .expect(200),
    );
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      cancelReason: 'Wrong payer',
    });
    expect(cancelled.allocations.every((a) => a.reversedAt)).toBe(true);
    const again = await admin()
      .post(`/api/receipts/${id}/cancel`, { reason: 'Again' })
      .expect(409);
    expect(error(again).code).toBe('RECEIPT_CANCELLED');
    expect((await statement('s1')).outstanding).toBe(200_000);
    // Payments can't be edited or deleted.
    await admin().delete(`/api/payments/${id}`).expect(404);
    await assertInvariant();
  });

  it('reconciles each collector’s day to their receipts', async () => {
    const day = data<{
      collectors: {
        total: number;
        count: number;
        cancelled: number;
        receipts: { status: string; amount: number }[];
      }[];
      total: number;
    }>(await admin().get('/api/fees/reports/daily-collection').expect(200));
    for (const c of day.collectors) {
      const valid = c.receipts.filter((r) => r.status === 'valid');
      expect(c.total).toBe(valid.reduce((n, r) => n + r.amount, 0));
      expect(c.count).toBe(valid.length);
    }
    expect(day.total).toBe(100_000); // the ten 100.00 payments; the cancelled one is out
    const cash = data<{ closing: number; income: number; expense: number }>(
      await admin()
        .get(`/api/ledger/book?account=cash&from=${today}&to=${today}`)
        .expect(200),
    );
    expect(cash.closing).toBe(100_000);
    expect(cash.income - cash.expense).toBe(100_000);
  });

  it('applies adjustments only once approved, and refunds through the ledger', async () => {
    const s1 = (await statement('s1')).invoices[0];
    const tuition = s1.lines.find((l) => l.description === 'Tuition Fee')!;
    const waiver = await created(
      admin()
        .post('/api/fee-adjustments', {
          type: 'waiver',
          invoiceLineId: tuition.id,
          amount: 20_000,
          reason: 'Hardship',
        })
        .expect(201),
    );
    expect((await statement('s1')).outstanding).toBe(200_000);
    await admin().post(`/api/fee-adjustments/${waiver}/approve`).expect(200);
    expect((await statement('s1')).outstanding).toBe(180_000);

    // Pay the exam fee, then refund part of it as an overcharge.
    const exam = s1.lines.find((l) => l.description === 'Exam Fee')!;
    await admin()
      .post('/api/payments', {
        studentId: students.s1,
        channel: 'bank_slip',
        amount: 50_000,
        allocations: [{ invoiceLineId: exam.id, amount: 50_000 }],
      })
      .expect(201);
    const refund = await created(
      admin()
        .post('/api/fee-adjustments', {
          type: 'refund',
          invoiceLineId: exam.id,
          amount: 10_000,
          paidFrom: 'bank',
          reason: 'Charged twice for the lab part',
        })
        .expect(201),
    );
    await admin().post(`/api/fee-adjustments/${refund}/approve`).expect(200);
    expect((await statement('s1')).outstanding).toBe(130_000);
    const bank = data<{ income: number; expense: number }>(
      await admin()
        .get(`/api/ledger/book?account=bank&from=${today}&to=${today}`)
        .expect(200),
    );
    expect(bank).toMatchObject({ income: 50_000, expense: 10_000 });
    await assertInvariant();
  });

  it('adds a late fine once per rule, from the daily scheduler', async () => {
    await admin()
      .post('/api/late-fine-rules', {
        name: 'Late',
        kind: 'fixed',
        amount: 5000,
        graceDays: 0,
      })
      .expect(201);
    const overdue = data<InvoiceView>(
      await admin()
        .post('/api/invoices', {
          studentId: students.s3,
          dueDate: `${Y}-01-01`,
          lines: [{ description: 'Picnic', amount: 30_000 }],
        })
        .expect(201),
    );
    const scheduler = e.app.get(FeeScheduler);
    await scheduler.runOnce(new Date(), [schools.a.org.id]);
    await scheduler.runOnce(new Date(), [schools.a.org.id]);
    const after = data<InvoiceView>(
      await admin().get(`/api/invoices/${overdue.id}`).expect(200),
    );
    expect(after.lines.filter((l) => l.kind === 'fine')).toHaveLength(1);
    expect(after.netTotal).toBe(35_000);

    const dues = data<{
      totals: { outstanding: number; buckets: Record<string, number> };
    }>(await admin().get('/api/fees/dues').expect(200));
    const demand = await assertInvariant();
    expect(dues.totals.outstanding).toBe(demand.outstanding);
    const integrity = data<{ linesFixed: number; invoicesFixed: number }>(
      await admin().post('/api/fees/integrity-check').expect(200),
    );
    expect(integrity).toEqual({ linesFixed: 0, invoicesFixed: 0 });
  });

  it('prints a thermal receipt', async () => {
    const receipt = data<ReceiptView>(
      await admin()
        .post('/api/payments', {
          studentId: students.s3,
          channel: 'cash',
          amount: 5_000,
        })
        .expect(201),
    );
    const pdf = data<Row>(
      await admin()
        .post(`/api/receipts/${receipt.id}/pdf`, { paper: '80mm' })
        .expect(202),
    );
    const done = await job(pdf.id);
    expect(done.status).toBe('succeeded');
    expect(done.downloadUrl).toBeTruthy();
  });

  it('records expenses in the cash book and voids them with a reversal', async () => {
    const category = await created(
      admin()
        .post('/api/expenses/categories', { name: 'Stationery' })
        .expect(201),
    );
    const expense = data<{ id: string; voucherNo: string }>(
      await admin()
        .post('/api/expenses', {
          categoryId: category,
          amount: 25_000,
          paidFrom: 'cash',
        })
        .expect(201),
    );
    expect(expense.voucherNo).toMatch(new RegExp(`^EXP-${Y}-00001$`));
    await admin()
      .post(`/api/expenses/${expense.id}/void`, { reason: 'Duplicate' })
      .expect(200);
    const cash = data<{ entries: { sourceType: string }[] }>(
      await admin()
        .get(`/api/ledger/book?account=cash&from=${today}&to=${today}`)
        .expect(200),
    );
    expect(cash.entries.map((x) => x.sourceType)).toEqual(
      expect.arrayContaining(['expense', 'expense_void']),
    );
  });

  it("[tenant-isolation] [fee-regression] hides another school's invoices and receipts", async () => {
    const other = as(schools.b.token, schools.b.org);
    const invoice = (await statement('s1')).invoices[0];
    await other.get(`/api/invoices/${invoice.id}`).expect(404);
    await other.get(`/api/receipts/${ids.guardianReceipt}`).expect(404);
    expect(
      data<unknown[]>(await other.get('/api/invoices').expect(200)),
    ).toEqual([]);
  });
});
