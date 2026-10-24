import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Between, FindOptionsWhere } from 'typeorm';
import { Paginated } from '~/common/dto/paginated.dto';
import { RequestContext } from '~/shared/request-context/request-context.service';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { FileService, type IncomingFile } from '~/modules/files/file.service';
import { NumberingService } from '~/modules/numbering/numbering.service';
import { patternScope } from '~/modules/numbering/numbering-pattern';
import { SettingsService } from '~/modules/settings/services/settings.service';
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  FilterExpenseDto,
} from '../dto/report.dto';
import type { Expense, ExpenseCategory } from '../entities/ledger.entity';
import { LedgerDirection } from '../enums/fee.enum';
import {
  ExpenseCategoryRepository,
  ExpenseRepository,
} from '../repositories/fee.repositories';
import { LedgerService } from './ledger.service';

/**
 * Expenses (PRD 6.10 "income and expense ledger"): categories and paid
 * vouchers with attachments. A voucher is never edited; voiding it keeps
 * it and writes a reversing ledger entry.
 */
@Injectable()
export class ExpenseService {
  constructor(
    private readonly categoryRepo: ExpenseCategoryRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly ledger: LedgerService,
    private readonly files: FileService,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly context: RequestContext,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  categories(): Promise<ExpenseCategory[]> {
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  async createCategory(
    dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    if (await this.categoryRepo.findOne({ where: { name: dto.name } })) {
      throw new ConflictException({
        message: `A category is already called "${dto.name}"`,
        code: 'EXPENSE_CATEGORY_EXISTS',
      });
    }
    return this.categoryRepo.saveNew({ name: dto.name, isActive: true });
  }

  findFiltered(filter: FilterExpenseDto): Promise<Paginated<Expense>> {
    const where: FindOptionsWhere<Expense> = {};
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.from || filter.to) {
      where.date = Between(
        filter.from ?? '0001-01-01',
        filter.to ?? '9999-12-31',
      );
    }
    return this.expenseRepo.findPage(
      {
        where,
        relations: { category: true },
        order: { date: 'DESC', voucherNo: 'DESC' },
      },
      filter,
    );
  }

  /** Stores a receipt or bill to attach to a voucher. */
  async uploadAttachment(file: IncomingFile): Promise<{ fileId: string }> {
    return { fileId: (await this.files.upload(file, 'attachment')).id };
  }

  create(dto: CreateExpenseDto): Promise<Expense> {
    return this.ds.runInTransaction(async () => {
      const category = await this.categoryRepo.findByIdOrFail(dto.categoryId);
      for (const id of dto.attachmentFileIds ?? [])
        await this.files.findById(id);
      const { voucher } = await this.settings.getSection('numbering');
      const date = dto.date ?? (await this.settings.today());
      const expense = await this.expenseRepo.saveNew({
        voucherNo: await this.numbering.nextFormatted(
          'voucher',
          voucher,
          patternScope(voucher),
        ),
        categoryId: category.id,
        amount: dto.amount,
        paidFrom: dto.paidFrom,
        date,
        note: dto.note ?? null,
        attachmentFileIds: dto.attachmentFileIds ?? [],
        createdBy: this.context.current().userId,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      });
      await this.ledger.record({
        date,
        direction: LedgerDirection.EXPENSE,
        account: dto.paidFrom,
        amount: dto.amount,
        sourceType: 'expense',
        sourceId: expense.id,
        description: `${expense.voucherNo}: ${category.name}`,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.EXPENSE_RECORDED,
        entityType: 'expense',
        entityId: expense.id,
        after: {
          voucherNo: expense.voucherNo,
          amount: dto.amount,
          paidFrom: dto.paidFrom,
        },
      });
      return expense;
    });
  }

  void(id: string, reason: string): Promise<Expense> {
    return this.ds.runInTransaction(async () => {
      const expense = await this.expenseRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!expense) throw new NotFoundException(`Expense "${id}" not found`);
      if (expense.voidedAt) {
        throw new ConflictException({
          message: 'The voucher is already void',
          code: 'EXPENSE_VOID',
        });
      }
      await this.expenseRepo.updateById(id, {
        voidedAt: new Date(),
        voidedBy: this.context.current().userId,
        voidReason: reason,
      });
      await this.ledger.record({
        date: await this.settings.today(),
        direction: LedgerDirection.INCOME,
        account: expense.paidFrom,
        amount: expense.amount,
        sourceType: 'expense_void',
        sourceId: id,
        description: `${expense.voucherNo} voided`,
      });
      await this.audit.record({
        action: AUDIT_ACTIONS.EXPENSE_VOIDED,
        entityType: 'expense',
        entityId: id,
        after: { reason },
      });
      return this.expenseRepo.findByIdOrFail(id);
    });
  }
}
