import { Inject, Injectable } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsWhere,
  In,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { BaseTenantRepository } from '~/tenancy/base-tenant.repository';
import { Adjustment } from '../entities/adjustment.entity';
import { BillingRun } from '../entities/billing-run.entity';
import { DiscountType, StudentDiscount } from '../entities/discount.entity';
import { FeeHead } from '../entities/fee-head.entity';
import {
  FeeStructure,
  FeeStructureItem,
} from '../entities/fee-structure.entity';
import { Invoice, InvoiceLine } from '../entities/invoice.entity';
import { LateFineRule } from '../entities/late-fine-rule.entity';
import {
  Expense,
  ExpenseCategory,
  LedgerEntry,
} from '../entities/ledger.entity';
import {
  Payment,
  PaymentAllocation,
  PaymentReversal,
  Receipt,
} from '../entities/payment.entity';

/**
 * The fee module's repositories: the base tenant repository plus the few
 * writes and query builders the services need. Query builders are not
 * org-scoped by the proxy, so `qb()` adds `org_id` itself.
 */
abstract class FeeRepository<
  T extends ObjectLiteral,
> extends BaseTenantRepository<T> {
  constructor(
    protected readonly ds: TenantDataSourceProxy,
    entity: new () => T,
    name: string,
  ) {
    super(ds, entity, name);
  }

  async updateWhere(
    where: FindOptionsWhere<T>,
    patch: Partial<T>,
  ): Promise<void> {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(defined).length) {
      await this.repo.update(where, defined as never);
    }
  }

  async updateById(id: string, patch: Partial<T>): Promise<void> {
    await this.updateWhere({ id } as unknown as FindOptionsWhere<T>, patch);
  }

  async insertMany(rows: DeepPartial<T>[]): Promise<void> {
    if (rows.length) await this.repo.insert(rows as never);
  }

  async deleteWhere(where: FindOptionsWhere<T>): Promise<void> {
    await this.repo.delete(where);
  }

  findByIds(ids: string[]): Promise<T[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo.find({
      where: { id: In(ids) } as unknown as FindOptionsWhere<T>,
    });
  }

  /** A query builder pinned to the org. */
  qb(alias: string): SelectQueryBuilder<T> {
    return this.repo
      .createQueryBuilder(alias)
      .where(`${alias}.orgId = :orgId`, { orgId: this.orgId });
  }

  /** Raw SQL on the request's connection; pass `this.orgId` as a parameter. */
  sql<R>(query: string, params: unknown[]): Promise<R> {
    return this.ds.getManager().query(query, params);
  }

  get org(): string {
    return this.orgId;
  }
}

@Injectable()
export class FeeHeadRepository extends FeeRepository<FeeHead> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, FeeHead, 'FeeHead');
  }
}

@Injectable()
export class FeeStructureRepository extends FeeRepository<FeeStructure> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, FeeStructure, 'FeeStructure');
  }
}

@Injectable()
export class FeeStructureItemRepository extends FeeRepository<FeeStructureItem> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, FeeStructureItem, 'FeeStructureItem');
  }
}

@Injectable()
export class DiscountTypeRepository extends FeeRepository<DiscountType> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, DiscountType, 'DiscountType');
  }
}

@Injectable()
export class StudentDiscountRepository extends FeeRepository<StudentDiscount> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, StudentDiscount, 'StudentDiscount');
  }
}

@Injectable()
export class LateFineRuleRepository extends FeeRepository<LateFineRule> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, LateFineRule, 'LateFineRule');
  }
}

@Injectable()
export class InvoiceRepository extends FeeRepository<Invoice> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Invoice, 'Invoice');
  }
}

@Injectable()
export class InvoiceLineRepository extends FeeRepository<InvoiceLine> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, InvoiceLine, 'InvoiceLine');
  }
}

@Injectable()
export class PaymentRepository extends FeeRepository<Payment> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Payment, 'Payment');
  }
}

@Injectable()
export class PaymentAllocationRepository extends FeeRepository<PaymentAllocation> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, PaymentAllocation, 'PaymentAllocation');
  }
}

@Injectable()
export class ReceiptRepository extends FeeRepository<Receipt> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Receipt, 'Receipt');
  }
}

@Injectable()
export class PaymentReversalRepository extends FeeRepository<PaymentReversal> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, PaymentReversal, 'PaymentReversal');
  }
}

@Injectable()
export class AdjustmentRepository extends FeeRepository<Adjustment> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Adjustment, 'Adjustment');
  }
}

@Injectable()
export class BillingRunRepository extends FeeRepository<BillingRun> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, BillingRun, 'BillingRun');
  }
}

@Injectable()
export class ExpenseCategoryRepository extends FeeRepository<ExpenseCategory> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, ExpenseCategory, 'ExpenseCategory');
  }
}

@Injectable()
export class ExpenseRepository extends FeeRepository<Expense> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, Expense, 'Expense');
  }
}

@Injectable()
export class LedgerEntryRepository extends FeeRepository<LedgerEntry> {
  constructor(@Inject(TENANT_DATASOURCE) ds: TenantDataSourceProxy) {
    super(ds, LedgerEntry, 'LedgerEntry');
  }
}

export const FEE_REPOSITORIES = [
  FeeHeadRepository,
  FeeStructureRepository,
  FeeStructureItemRepository,
  DiscountTypeRepository,
  StudentDiscountRepository,
  LateFineRuleRepository,
  InvoiceRepository,
  InvoiceLineRepository,
  PaymentRepository,
  PaymentAllocationRepository,
  ReceiptRepository,
  PaymentReversalRepository,
  AdjustmentRepository,
  BillingRunRepository,
  ExpenseCategoryRepository,
  ExpenseRepository,
  LedgerEntryRepository,
];
