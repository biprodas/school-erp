import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { DEFAULT_FEE_HEADS } from '~/shared/templates';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { ClassService } from '~/modules/classes/class.service';
import { ShiftService } from '~/modules/shifts/shift.service';
import { SubjectGroupService } from '~/modules/subject-groups/services/subject-group.service';
import {
  CreateDiscountTypeDto,
  CreateFeeHeadDto,
  CreateFeeStructureDto,
  CreateLateFineRuleDto,
  FeeStructureItemDto,
  FilterFeeStructureDto,
  UpdateDiscountTypeDto,
  UpdateFeeHeadDto,
  UpdateFeeStructureDto,
  UpdateLateFineRuleDto,
} from '../dto/fee-setup.dto';
import type { DiscountType } from '../entities/discount.entity';
import type { FeeHead } from '../entities/fee-head.entity';
import type { FeeStructure } from '../entities/fee-structure.entity';
import type { LateFineRule } from '../entities/late-fine-rule.entity';
import { DiscountKind, FeeFrequency } from '../enums/fee.enum';
import {
  DiscountTypeRepository,
  FeeHeadRepository,
  FeeStructureItemRepository,
  FeeStructureRepository,
  LateFineRuleRepository,
} from '../repositories/fee.repositories';

const TEMPLATE_FREQUENCY: Record<string, FeeFrequency> = {
  once: FeeFrequency.ONE_TIME,
  monthly: FeeFrequency.MONTHLY,
  yearly: FeeFrequency.YEARLY,
  per_exam: FeeFrequency.ONE_TIME,
};

/**
 * Fee setup (PRD 6.10, workflow 7.3 step 1): fee heads, the session's fee
 * structures per class (optionally per group or shift), discount types
 * and late-fine rules.
 */
@Injectable()
export class FeeSetupService {
  constructor(
    private readonly headRepo: FeeHeadRepository,
    private readonly structureRepo: FeeStructureRepository,
    private readonly itemRepo: FeeStructureItemRepository,
    private readonly discountTypeRepo: DiscountTypeRepository,
    private readonly fineRuleRepo: LateFineRuleRepository,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly subjectGroups: SubjectGroupService,
    private readonly shifts: ShiftService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  // --- Fee heads -----------------------------------------------------------

  listHeads(): Promise<FeeHead[]> {
    return this.headRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  findHead(id: string): Promise<FeeHead> {
    return this.headRepo.findByIdOrFail(id);
  }

  async createHead(dto: CreateFeeHeadDto): Promise<FeeHead> {
    await this.assertHeadNameFree(dto.name);
    return this.headRepo.saveNew({
      name: dto.name,
      nameBn: dto.nameBn ?? null,
      frequency: dto.frequency,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateHead(id: string, dto: UpdateFeeHeadDto): Promise<FeeHead> {
    const head = await this.findHead(id);
    if (dto.name && dto.name !== head.name)
      await this.assertHeadNameFree(dto.name);
    return this.headRepo.save(Object.assign(head, dto));
  }

  /** Refused (409) once structures or invoices use it: deactivate it then. */
  async removeHead(id: string): Promise<void> {
    await this.findHead(id);
    await this.headRepo.deleteById(id);
  }

  /** Onboarding: the default fee heads, adding only missing names. */
  applyDefaultHeads(): Promise<{ created: number; skipped: number }> {
    return this.ds.runInTransaction(async () => {
      const existing = new Set(
        (await this.listHeads()).map((h) => h.name.trim().toLowerCase()),
      );
      let created = 0;
      for (const [i, t] of DEFAULT_FEE_HEADS.entries()) {
        if (existing.has(t.name.toLowerCase())) continue;
        await this.headRepo.saveNew({
          name: t.name,
          nameBn: null,
          frequency: TEMPLATE_FREQUENCY[t.frequency],
          isActive: true,
          sortOrder: i,
        });
        created++;
      }
      const result = { created, skipped: DEFAULT_FEE_HEADS.length - created };
      await this.audit.record({
        action: AUDIT_ACTIONS.TEMPLATE_APPLIED,
        entityType: 'template',
        entityId: 'fee-heads',
        after: result,
      });
      return result;
    });
  }

  // --- Structures ----------------------------------------------------------

  listStructures(filter: FilterFeeStructureDto): Promise<FeeStructure[]> {
    return this.structureRepo.find({
      where: { academicYearId: filter.academicYearId, classId: filter.classId },
      relations: { items: { feeHead: true }, schoolClass: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findStructure(id: string): Promise<FeeStructure> {
    const s = await this.structureRepo.findOne({
      where: { id },
      relations: { items: { feeHead: true }, schoolClass: true },
    });
    if (!s) throw new NotFoundException(`Fee structure "${id}" not found`);
    return s;
  }

  /** The session's structures with items and heads (billing). */
  structuresFor(academicYearId: string, classIds: string[] | null) {
    return this.structureRepo.find({
      where: {
        academicYearId,
        ...(classIds ? { classId: In(classIds) } : {}),
      },
      relations: { items: { feeHead: true } },
    });
  }

  createStructure(dto: CreateFeeStructureDto): Promise<FeeStructure> {
    return this.ds.runInTransaction(async () => {
      const year = await this.academicYears.findById(dto.academicYearId);
      await this.classes.findById(dto.classId);
      if (dto.subjectGroupId)
        await this.subjectGroups.findById(dto.subjectGroupId);
      if (dto.shiftId) await this.shifts.findById(dto.shiftId);
      const effectiveFrom = dto.effectiveFrom ?? year.startDate!;
      assertWindow(year, effectiveFrom, dto.effectiveTo ?? null);
      const saved = await this.structureRepo.saveNew({
        name: dto.name,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        subjectGroupId: dto.subjectGroupId ?? null,
        shiftId: dto.shiftId ?? null,
        effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
      });
      await this.replaceItems(saved.id, dto.items);
      return this.findStructure(saved.id);
    });
  }

  updateStructure(
    id: string,
    dto: UpdateFeeStructureDto,
  ): Promise<FeeStructure> {
    return this.ds.runInTransaction(async () => {
      const s = await this.findStructure(id);
      const year = await this.academicYears.findById(s.academicYearId);
      const effectiveFrom = dto.effectiveFrom ?? s.effectiveFrom;
      const effectiveTo =
        dto.effectiveTo !== undefined ? dto.effectiveTo : s.effectiveTo;
      assertWindow(year, effectiveFrom, effectiveTo);
      if (dto.subjectGroupId)
        await this.subjectGroups.findById(dto.subjectGroupId);
      if (dto.shiftId) await this.shifts.findById(dto.shiftId);
      await this.structureRepo.updateById(id, {
        name: dto.name,
        subjectGroupId: dto.subjectGroupId,
        shiftId: dto.shiftId,
        effectiveFrom,
        effectiveTo,
      });
      if (dto.items) await this.replaceItems(id, dto.items);
      return this.findStructure(id);
    });
  }

  /** Invoices already made keep their lines. */
  async removeStructure(id: string): Promise<void> {
    await this.findStructure(id);
    await this.structureRepo.deleteById(id);
  }

  // --- Discount types and fine rules -----------------------------------------

  listDiscountTypes(): Promise<DiscountType[]> {
    return this.discountTypeRepo.find({ order: { name: 'ASC' } });
  }

  findDiscountType(id: string): Promise<DiscountType> {
    return this.discountTypeRepo.findByIdOrFail(id);
  }

  async createDiscountType(dto: CreateDiscountTypeDto): Promise<DiscountType> {
    assertDiscountValue(dto.kind, dto.value);
    await this.assertHeads(dto.appliesToHeadIds ?? []);
    return this.discountTypeRepo.saveNew({
      name: dto.name,
      code: dto.code,
      kind: dto.kind,
      value: dto.value,
      appliesToHeadIds: dto.appliesToHeadIds ?? [],
      isActive: dto.isActive ?? true,
    });
  }

  async updateDiscountType(
    id: string,
    dto: UpdateDiscountTypeDto,
  ): Promise<DiscountType> {
    const type = await this.findDiscountType(id);
    assertDiscountValue(dto.kind ?? type.kind, dto.value ?? type.value);
    if (dto.appliesToHeadIds) await this.assertHeads(dto.appliesToHeadIds);
    return this.discountTypeRepo.save(Object.assign(type, dto));
  }

  listFineRules(): Promise<LateFineRule[]> {
    return this.fineRuleRepo.find({
      relations: { feeHead: true },
      order: { name: 'ASC' },
    });
  }

  activeFineRules(): Promise<LateFineRule[]> {
    return this.fineRuleRepo.find({ where: { isActive: true } });
  }

  async createFineRule(dto: CreateLateFineRuleDto): Promise<LateFineRule> {
    if (dto.feeHeadId) await this.findHead(dto.feeHeadId);
    return this.fineRuleRepo.saveNew({
      name: dto.name,
      feeHeadId: dto.feeHeadId ?? null,
      kind: dto.kind,
      amount: dto.amount,
      graceDays: dto.graceDays ?? null,
      maxAmount: dto.maxAmount ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async updateFineRule(
    id: string,
    dto: UpdateLateFineRuleDto,
  ): Promise<LateFineRule> {
    const rule = await this.fineRuleRepo.findByIdOrFail(id);
    if (dto.feeHeadId) await this.findHead(dto.feeHeadId);
    delete rule.feeHead;
    return this.fineRuleRepo.save(Object.assign(rule, dto));
  }

  async removeFineRule(id: string): Promise<void> {
    await this.fineRuleRepo.findByIdOrFail(id);
    await this.fineRuleRepo.deleteById(id);
  }

  // --- Helpers -------------------------------------------------------------

  private async replaceItems(
    structureId: string,
    items: FeeStructureItemDto[],
  ) {
    const heads = new Set(items.map((i) => i.feeHeadId));
    if (heads.size !== items.length) {
      throw new BadRequestException({
        message: 'Each fee head can appear once in a structure',
        code: 'DUPLICATE_FEE_HEAD',
      });
    }
    await this.assertHeads([...heads]);
    await this.itemRepo.deleteWhere({ feeStructureId: structureId });
    await this.itemRepo.insertMany(
      items.map((i) => ({
        feeStructureId: structureId,
        feeHeadId: i.feeHeadId,
        amount: i.amount,
        dueDay: i.dueDay ?? null,
        months: i.months?.length
          ? [...new Set(i.months)].sort((a, b) => a - b)
          : null,
      })),
    );
  }

  private async assertHeads(ids: string[]) {
    const found = await this.headRepo.findByIds(ids);
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException({
        message: 'Unknown fee head',
        code: 'UNKNOWN_FEE_HEAD',
      });
    }
  }

  private async assertHeadNameFree(name: string) {
    if (await this.headRepo.findOne({ where: { name } })) {
      throw new ConflictException({
        message: `A fee head is already called "${name}"`,
        code: 'FEE_HEAD_EXISTS',
      });
    }
  }
}

function assertWindow(
  year: { startDate: string | null; endDate: string | null },
  from: string,
  to: string | null,
) {
  const outside = (d: string) =>
    (!!year.startDate && d < year.startDate) ||
    (!!year.endDate && d > year.endDate);
  if (outside(from) || (to !== null && outside(to))) {
    throw new BadRequestException({
      message: 'Effective dates must fall inside the session',
      code: 'DATE_OUTSIDE_SESSION',
    });
  }
  if (to !== null && to < from) {
    throw new BadRequestException({
      message: 'A structure must end on or after it starts',
      code: 'INVALID_DATE_RANGE',
    });
  }
}

function assertDiscountValue(kind: DiscountKind, value: number) {
  if (kind === DiscountKind.PERCENT && value > 10_000) {
    throw new BadRequestException({
      message: 'A percentage discount is at most 10000 basis points (100%)',
      code: 'INVALID_DISCOUNT',
    });
  }
}
