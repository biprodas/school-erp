import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '~/modules/rbac/rbac.module';
import { AcademicYearModule } from '~/modules/academic-years/academic-year.module';
import { AccessScopeModule } from '~/modules/access-scope/access-scope.module';
import { ClassModule } from '~/modules/classes/class.module';
import { DomainEventModule } from '~/modules/domain-events/domain-event.module';
import { EnrollmentModule } from '~/modules/enrollments/enrollment.module';
import { FileModule } from '~/modules/files/file.module';
import { GuardianModule } from '~/modules/guardians/guardian.module';
import { JobModule } from '~/modules/jobs/job.module';
import { NumberingModule } from '~/modules/numbering/numbering.module';
import { Organization } from '~/modules/organizations/entities/organization.entity';
import { PlanModule } from '~/modules/plans/plan.module';
import { SectionModule } from '~/modules/sections/section.module';
import { SettingsModule } from '~/modules/settings/settings.module';
import { ShiftModule } from '~/modules/shifts/shift.module';
import { StudentModule } from '~/modules/students/student.module';
import { SubjectGroupModule } from '~/modules/subject-groups/subject-group.module';
import { AdjustmentController } from './controllers/adjustment.controller';
import { DiscountTypeController } from './controllers/discount-type.controller';
import {
  ExpenseController,
  LedgerController,
} from './controllers/expense.controller';
import { FeeHeadController } from './controllers/fee-head.controller';
import { FeeReportController } from './controllers/fee-report.controller';
import { FeeStructureController } from './controllers/fee-structure.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { LateFineRuleController } from './controllers/late-fine-rule.controller';
import {
  PaymentController,
  ReceiptController,
} from './controllers/payment.controller';
import { StudentDiscountController } from './controllers/student-discount.controller';
import { FeeScheduler } from './fee.scheduler';
import { FeeJobs } from './fees.jobs';
import { FEE_REPOSITORIES } from './repositories/fee.repositories';
import { AdjustmentService } from './services/adjustment.service';
import { BillingService } from './services/billing.service';
import { ExpenseService } from './services/expense.service';
import { FeeIntegrityService } from './services/fee-integrity.service';
import { FeeReportService } from './services/fee-report.service';
import { FeeSetupService } from './services/fee-setup.service';
import { InvoiceTotalsService } from './services/invoice-totals.service';
import { InvoiceService } from './services/invoice.service';
import { LateFineService } from './services/late-fine.service';
import { LedgerService } from './services/ledger.service';
import { PaymentService } from './services/payment.service';
import { StudentDiscountService } from './services/student-discount.service';

/**
 * Fees and finance (PRD 6.10): setup, invoices, counter collection with
 * allocation and receipts, adjustments, dues and reports, expenses and the
 * cash and bank ledger. Online payments and reconciliation are Phase 1b.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    RbacModule,
    AccessScopeModule,
    PlanModule,
    AcademicYearModule,
    ClassModule,
    SectionModule,
    ShiftModule,
    SubjectGroupModule,
    StudentModule,
    GuardianModule,
    EnrollmentModule,
    NumberingModule,
    SettingsModule,
    DomainEventModule,
    FileModule,
    JobModule,
  ],
  controllers: [
    FeeHeadController,
    FeeStructureController,
    DiscountTypeController,
    StudentDiscountController,
    LateFineRuleController,
    InvoiceController,
    PaymentController,
    ReceiptController,
    AdjustmentController,
    FeeReportController,
    ExpenseController,
    LedgerController,
  ],
  providers: [
    ...FEE_REPOSITORIES,
    LedgerService,
    InvoiceTotalsService,
    FeeSetupService,
    StudentDiscountService,
    BillingService,
    InvoiceService,
    LateFineService,
    PaymentService,
    AdjustmentService,
    FeeReportService,
    ExpenseService,
    FeeIntegrityService,
    FeeJobs,
    FeeScheduler,
  ],
  exports: [FeeSetupService, FeeReportService],
})
export class FeeModule {}
