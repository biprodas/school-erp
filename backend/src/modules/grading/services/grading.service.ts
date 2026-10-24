import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GRADING_TEMPLATES, type GradingTemplate } from '~/shared/templates';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AuditService } from '~/modules/audit/services/audit.service';
import { ClassService } from '~/modules/classes/class.service';
import {
  CreateFromTemplateDto,
  CreateGradingSystemDto,
  GradeBandDto,
  GradingRulesDto,
  SetClassGradingDto,
  UpdateGradingSystemDto,
} from '../dto/grading-system.dto';
import type { ClassGrading } from '../entities/class-grading.entity';
import type { GradingSystem } from '../entities/grading-system.entity';
import type {
  GradeBand,
  GradingKind,
  GradingRules,
  GradingScheme,
} from '../engine/types';
import { ClassGradingRepository } from '../repositories/class-grading.repository';
import { GradeScaleItemRepository } from '../repositories/grade-scale-item.repository';
import { GradingSystemRepository } from '../repositories/grading-system.repository';

/** Rules a system made without a template starts from (BD-style, no 4th). */
const BASE_RULES: GradingRules = {
  markRounding: 'none',
  componentPass: true,
  failedSubjectFailsResult: true,
  fourthSubject: { enabled: false, threshold: 2 },
  gpaCap: null,
  gpaRounding: 'round',
  grace: null,
  divisions: [],
  failGrade: 'F',
};

/** A system with its scale, ready for the engine. */
export interface ResolvedGrading {
  system: GradingSystem;
  scheme: GradingScheme;
}

/**
 * Grading systems (PRD 6.9): grade scales and rules per school, made from
 * templates or by hand, assigned to classes per session. Exams and results
 * ask `schemeFor(year, class)` for what to grade with.
 */
@Injectable()
export class GradingService {
  private resolved = new Map<string, Promise<ResolvedGrading>>();

  constructor(
    private readonly systemRepo: GradingSystemRepository,
    private readonly itemRepo: GradeScaleItemRepository,
    private readonly classGradingRepo: ClassGradingRepository,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  templates() {
    return GRADING_TEMPLATES;
  }

  findAll(): Promise<GradingSystem[]> {
    return this.systemRepo.findAllWithItems();
  }

  async findById(id: string): Promise<GradingSystem> {
    const system = await this.systemRepo.findWithItems(id);
    if (!system)
      throw new NotFoundException(`Grading system "${id}" not found`);
    return system;
  }

  /** The class's system in the session, else the school's default. */
  schemeFor(academicYearId: string, classId: string): Promise<ResolvedGrading> {
    const key = `${academicYearId}:${classId}`;
    if (!this.resolved.has(key)) {
      this.resolved.set(key, this.resolve(academicYearId, classId));
      // A failure shouldn't stick for the rest of the request.
      this.resolved.get(key)!.catch(() => this.resolved.delete(key));
    }
    return this.resolved.get(key)!;
  }

  create(dto: CreateGradingSystemDto): Promise<GradingSystem> {
    return this.ds.runInTransaction(async () => {
      const id = await this.insert({
        name: dto.name,
        kind: dto.kind,
        rules: mergeRules(BASE_RULES, dto.rules),
        items: dto.items,
        isDefault: dto.isDefault ?? false,
        templateCode: null,
      });
      return this.findById(id);
    });
  }

  /** A new system from a template (`bd-gpa-5`, `gpa-4`, …). */
  createFromTemplate(
    code: string,
    dto: CreateFromTemplateDto = {},
  ): Promise<GradingSystem> {
    const template = findTemplate(code);
    return this.ds.runInTransaction(async () => {
      const id = await this.insert({
        name: dto.name ?? template.name,
        kind: template.kind,
        rules: template.rules,
        items: template.bands,
        isDefault: dto.isDefault ?? !(await this.systemRepo.findDefault()),
        templateCode: template.code,
      });
      return this.findById(id);
    });
  }

  /**
   * Onboarding's "apply": the template's system unless one was already
   * made from it (idempotent). The first system becomes the default.
   */
  applyTemplate(code: string): Promise<{
    gradingSystem: GradingSystem;
    created: boolean;
  }> {
    const template = findTemplate(code);
    return this.ds.runInTransaction(async () => {
      const existing = await this.systemRepo.findByTemplate(template.code);
      if (existing) {
        return {
          gradingSystem: await this.findById(existing.id),
          created: false,
        };
      }
      const gradingSystem = await this.createFromTemplate(code);
      await this.audit.record({
        action: AUDIT_ACTIONS.TEMPLATE_APPLIED,
        entityType: 'template',
        entityId: template.code,
        after: { gradingSystemId: gradingSystem.id },
      });
      return { gradingSystem, created: true };
    });
  }

  update(id: string, dto: UpdateGradingSystemDto): Promise<GradingSystem> {
    return this.ds.runInTransaction(async () => {
      const system = await this.findById(id);
      if (dto.name && dto.name !== system.name)
        await this.assertNameFree(dto.name);
      if (dto.isDefault) await this.systemRepo.clearDefault();
      const rules = dto.rules ? mergeRules(system.rules, dto.rules) : undefined;
      if (rules) assertRules(system.kind, rules);
      await this.systemRepo.updateFields(id, {
        name: dto.name,
        rules,
        isDefault: dto.isDefault ? true : undefined,
      });
      return this.findById(id);
    });
  }

  replaceScale(id: string, items: GradeBandDto[]): Promise<GradingSystem> {
    return this.ds.runInTransaction(async () => {
      await this.findById(id);
      await this.itemRepo.replace(id, scaleRows(items));
      return this.findById(id);
    });
  }

  /** Refused (409) while a class uses it. */
  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.systemRepo.deleteById(id);
  }

  // --- Class assignment ----------------------------------------------------

  listClassGrading(academicYearId?: string): Promise<ClassGrading[]> {
    return this.classGradingRepo.findInYear(academicYearId);
  }

  async setClassGrading(dto: SetClassGradingDto): Promise<ClassGrading> {
    await this.academicYears.findById(dto.academicYearId);
    await this.classes.findById(dto.classId);
    await this.findById(dto.gradingSystemId);
    const existing = await this.classGradingRepo.findFor(
      dto.academicYearId,
      dto.classId,
    );
    if (existing) {
      existing.gradingSystemId = dto.gradingSystemId;
      delete existing.gradingSystem;
      return this.classGradingRepo.save(existing);
    }
    return this.classGradingRepo.saveNew({ ...dto });
  }

  async removeClassGrading(id: string): Promise<void> {
    await this.classGradingRepo.findByIdOrFail(id);
    await this.classGradingRepo.deleteById(id);
  }

  // --- Helpers -------------------------------------------------------------

  private async resolve(
    academicYearId: string,
    classId: string,
  ): Promise<ResolvedGrading> {
    const assigned = await this.classGradingRepo.findFor(
      academicYearId,
      classId,
    );
    const systemId =
      assigned?.gradingSystemId ?? (await this.systemRepo.findDefault())?.id;
    if (!systemId) {
      throw new ConflictException({
        message:
          'No grading system: add one (from a template) or assign one to the class',
        code: 'NO_GRADING_SYSTEM',
      });
    }
    const system = await this.findById(systemId);
    return { system, scheme: toScheme(system) };
  }

  private async insert(input: {
    name: string;
    kind: GradingKind;
    rules: GradingRules;
    items: GradeBand[] | GradeBandDto[];
    isDefault: boolean;
    templateCode: string | null;
  }): Promise<string> {
    await this.assertNameFree(input.name);
    assertRules(input.kind, input.rules);
    if (input.isDefault) await this.systemRepo.clearDefault();
    const system = await this.systemRepo.saveNew({
      name: input.name,
      kind: input.kind,
      rules: input.rules,
      isDefault: input.isDefault,
      templateCode: input.templateCode,
    });
    await this.itemRepo.replace(system.id, scaleRows(input.items));
    return system.id;
  }

  private async assertNameFree(name: string): Promise<void> {
    if (await this.systemRepo.findByName(name)) {
      throw new ConflictException({
        message: `A grading system is already called "${name}"`,
        code: 'GRADING_SYSTEM_EXISTS',
      });
    }
  }
}

/** The engine's view of a stored system. */
export function toScheme(system: GradingSystem): GradingScheme {
  return {
    kind: system.kind,
    rules: system.rules,
    bands: (system.items ?? []).map((i) => ({
      letter: i.letter,
      minPercent: i.minPercent,
      maxPercent: i.maxPercent,
      point: i.point,
      isFail: i.isFail,
    })),
  };
}

function findTemplate(code: string): GradingTemplate {
  const template = GRADING_TEMPLATES.find((t) => t.code === code);
  if (!template) {
    throw new NotFoundException({
      message: 'Template not found',
      code: 'TEMPLATE_NOT_FOUND',
    });
  }
  return template;
}

function mergeRules(base: GradingRules, patch?: GradingRulesDto): GradingRules {
  if (!patch) return { ...base };
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as unknown as GradingRules;
}

function assertRules(kind: GradingKind, rules: GradingRules): void {
  if (kind === 'percentage' && !rules.divisions.length) {
    throw new BadRequestException({
      message: 'A percentage system needs at least one division',
      code: 'INVALID_GRADING_RULES',
    });
  }
}

/** Validates a scale and orders it from the top band down. */
function scaleRows(items: (GradeBand | GradeBandDto)[]) {
  const letters = new Set(items.map((i) => i.letter.trim()));
  if (letters.size !== items.length) {
    throw new BadRequestException({
      message: 'Each grade letter can appear once',
      code: 'INVALID_GRADE_SCALE',
    });
  }
  if (
    !items.some((i) => i.minPercent === 0) ||
    !items.some((i) => !i.isFail) ||
    items.some((i) => i.maxPercent < i.minPercent)
  ) {
    throw new BadRequestException({
      message:
        'A scale needs a band starting at 0%, at least one passing band, and min ≤ max',
      code: 'INVALID_GRADE_SCALE',
    });
  }
  return [...items]
    .sort((a, b) => b.minPercent - a.minPercent)
    .map((i, index) => ({
      letter: i.letter.trim(),
      minPercent: i.minPercent,
      maxPercent: i.maxPercent,
      point: i.point,
      isFail: i.isFail ?? false,
      sortOrder: index,
    }));
}
