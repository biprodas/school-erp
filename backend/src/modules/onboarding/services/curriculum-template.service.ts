import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '~/common/dto/paginated.dto';
import { MAX_PAGE_SIZE } from '~/common/dto/pagination-query.dto';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import {
  BD_FIXED_HOLIDAYS,
  BD_MOVABLE_HOLIDAYS,
  CURRICULUM_TEMPLATES,
  DEFAULT_FEE_HEADS,
  GRADING_TEMPLATES,
  type CurriculumTemplate,
  type TemplateClass,
} from '~/shared/templates';
import { AuditService } from '~/modules/audit/services/audit.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { ClassSubjectType } from '~/modules/class-curriculum/enums/class-subject-type.enum';
import { SubjectService } from '~/modules/subjects/subject.service';
import { SubjectGroupService } from '~/modules/subject-groups/services/subject-group.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { ClassSubjectGroupService } from '~/modules/class-curriculum/services/class-subject-group.service';

export interface ApplyResult {
  template: string;
  /** The session the class curriculum was added to; null when none is current. */
  academicYearId: string | null;
  created: {
    subjects: number;
    classes: number;
    subjectGroups: number;
    groupSubjects: number;
    classSubjects: number;
    /** CQ / MCQ / practical parts of the new class subjects. */
    components: number;
    classSubjectGroups: number;
  };
}

/** Every row of a paginated list (setup lists are small). */
async function all<T>(
  fetch: (q: { page: number; limit: number }) => Promise<Paginated<T>>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await fetch({ page, limit: MAX_PAGE_SIZE });
    items.push(...result.items);
    if (page >= result.meta.totalPages) return items;
  }
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * Applies code-defined setup templates (PRD 6.2 step 4): subjects, classes,
 * subject groups and, for the current session, each class's subjects and
 * groups. Idempotent: it only adds what is missing (classes and groups by
 * name, subjects by name or code), so it can be re-run after a partial
 * setup and never changes or removes the school's own data. Runs in one
 * transaction through the feature services, so their checks apply.
 */
@Injectable()
export class CurriculumTemplateService {
  constructor(
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly subjects: SubjectService,
    private readonly subjectGroups: SubjectGroupService,
    private readonly classSubjects: ClassSubjectService,
    private readonly classSubjectGroups: ClassSubjectGroupService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** What onboarding can offer. */
  list() {
    return {
      curriculum: CURRICULUM_TEMPLATES.map((t) => ({
        code: t.code,
        name: t.name,
        description: t.description,
        suggestedFor: t.suggestedFor,
        classes: t.classes.map((c) => c.name),
        subjects: t.subjects.length,
        groups: t.groups.map((g) => g.name),
      })),
      grading: GRADING_TEMPLATES.map((t) => ({ ...t, applicable: true })),
      feeHeads: { items: DEFAULT_FEE_HEADS, applicable: true },
      holidays: {
        code: 'bd',
        fixed: BD_FIXED_HOLIDAYS,
        movable: BD_MOVABLE_HOLIDAYS,
        applicable: true,
      },
    };
  }

  async applyCurriculum(
    code: string,
    academicYearId?: string,
  ): Promise<ApplyResult> {
    const template = CURRICULUM_TEMPLATES.find((t) => t.code === code);
    if (!template) {
      throw new NotFoundException({
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND',
      });
    }
    const year = academicYearId
      ? await this.academicYears.findById(academicYearId)
      : await this.academicYears.findCurrent();

    return this.ds.runInTransaction(async () => {
      const result: ApplyResult = {
        template: template.code,
        academicYearId: year?.id ?? null,
        created: {
          subjects: 0,
          classes: 0,
          subjectGroups: 0,
          groupSubjects: 0,
          classSubjects: 0,
          components: 0,
          classSubjectGroups: 0,
        },
      };
      const subjectIds = await this.ensureSubjects(template, result);
      const classIds = await this.ensureClasses(template, result);
      const groupIds = await this.ensureGroups(template, subjectIds, result);
      if (year) {
        await this.ensureCurriculum(
          template,
          year.id,
          { subjectIds, classIds, groupIds },
          result,
        );
      }
      await this.audit.record({
        action: AUDIT_ACTIONS.TEMPLATE_APPLIED,
        entityType: 'template',
        entityId: template.code,
        after: { ...result.created, academicYearId: result.academicYearId },
      });
      return result;
    });
  }

  private async ensureSubjects(
    t: CurriculumTemplate,
    result: ApplyResult,
  ): Promise<Map<string, string>> {
    const existing = await all((q) => this.subjects.findFiltered(q));
    const byName = new Map(existing.map((s) => [key(s.name), s.id]));
    const byCode = new Map(
      existing.filter((s) => s.code).map((s) => [s.code!, s.id]),
    );
    const ids = new Map<string, string>();
    for (const s of t.subjects) {
      let id = byName.get(key(s.name)) ?? (s.code && byCode.get(s.code));
      if (!id) {
        id = (
          await this.subjects.create({
            name: s.name,
            code: s.code,
            type: s.type,
          })
        ).id;
        if (s.code) byCode.set(s.code, id);
        result.created.subjects++;
      }
      ids.set(s.name, id);
    }
    return ids;
  }

  private async ensureClasses(
    t: CurriculumTemplate,
    result: ApplyResult,
  ): Promise<Map<string, string>> {
    const existing = await all((q) => this.classes.findFiltered(q));
    const byName = new Map(existing.map((c) => [key(c.name), c.id]));
    const ids = new Map<string, string>();
    for (const c of t.classes) {
      let id = byName.get(key(c.name));
      if (!id) {
        id = (await this.classes.create({ name: c.name, level: c.level })).id;
        result.created.classes++;
      }
      ids.set(c.name, id);
    }
    return ids;
  }

  private async ensureGroups(
    t: CurriculumTemplate,
    subjectIds: Map<string, string>,
    result: ApplyResult,
  ): Promise<Map<string, string>> {
    const existing = await all((q) => this.subjectGroups.findFiltered(q));
    const byName = new Map(existing.map((g) => [key(g.name), g.id]));
    const ids = new Map<string, string>();
    for (const g of t.groups) {
      let id = byName.get(key(g.name));
      if (!id) {
        id = (await this.subjectGroups.create({ name: g.name })).id;
        result.created.subjectGroups++;
      }
      ids.set(g.name, id);

      const linked = new Set(
        (await this.subjectGroups.listSubjects(id)).map((l) => l.subjectId),
      );
      for (const [order, s] of g.subjects.entries()) {
        const subjectId = subjectIds.get(s.name)!;
        if (linked.has(subjectId)) continue;
        await this.subjectGroups.attachSubject(id, {
          subjectId,
          isCompulsory: s.compulsory,
          displayOrder: order + 1,
        });
        result.created.groupSubjects++;
      }
    }
    return ids;
  }

  private async ensureCurriculum(
    t: CurriculumTemplate,
    academicYearId: string,
    ids: {
      subjectIds: Map<string, string>;
      classIds: Map<string, string>;
      groupIds: Map<string, string>;
    },
    result: ApplyResult,
  ): Promise<void> {
    const offered = new Set(
      (
        await all((q) =>
          this.classSubjects.findFiltered({ ...q, academicYearId }),
        )
      ).map((cs) => `${cs.classId}:${cs.subjectId}`),
    );
    const groupsOffered = new Set(
      (
        await all((q) =>
          this.classSubjectGroups.findFiltered({ ...q, academicYearId }),
        )
      ).map((cg) => `${cg.classId}:${cg.subjectGroupId}`),
    );

    const templateSubjects = new Map(t.subjects.map((s) => [s.name, s]));
    for (const c of t.classes) {
      const classId = ids.classIds.get(c.name)!;
      for (const s of classSubjects(t, c)) {
        const subjectId = ids.subjectIds.get(s.name)!;
        if (offered.has(`${classId}:${subjectId}`)) continue;
        const components = c.boardComponents
          ? templateSubjects.get(s.name)?.components
          : undefined;
        await this.classSubjects.create({
          classId,
          subjectId,
          academicYearId,
          subjectType: s.type,
          subjectGroupId: s.group ? ids.groupIds.get(s.group)! : null,
          components: components?.map((comp) => ({ ...comp })),
        });
        offered.add(`${classId}:${subjectId}`);
        result.created.classSubjects++;
        result.created.components += components?.length ?? 0;
      }
      for (const group of c.groups ?? []) {
        const subjectGroupId = ids.groupIds.get(group)!;
        if (groupsOffered.has(`${classId}:${subjectGroupId}`)) continue;
        await this.classSubjectGroups.create({
          classId,
          subjectGroupId,
          academicYearId,
        });
        result.created.classSubjectGroups++;
      }
    }
  }
}

/**
 * A template class's subjects with their type: the class lists first
 * (compulsory, optional, 4th), then the subjects of its groups not listed
 * yet. A group subject is compulsory when every group of the class that
 * lists it says so, and is tagged with its group only when one group lists
 * it (General Science is in two).
 */
export function classSubjects(
  t: CurriculumTemplate,
  c: TemplateClass,
): { name: string; type: ClassSubjectType; group: string | null }[] {
  const out = new Map<
    string,
    { name: string; type: ClassSubjectType; group: string | null }
  >();
  const add = (name: string, type: ClassSubjectType, group: string | null) => {
    if (!out.has(name)) out.set(name, { name, type, group });
  };
  c.compulsory.forEach((n) => add(n, ClassSubjectType.COMPULSORY, null));
  (c.optional ?? []).forEach((n) => add(n, ClassSubjectType.OPTIONAL, null));
  (c.fourth ?? []).forEach((n) => add(n, ClassSubjectType.FOURTH, null));

  const groups = t.groups.filter((g) => c.groups?.includes(g.name));
  for (const g of groups) {
    for (const { name } of g.subjects) {
      const listing = groups.filter((x) =>
        x.subjects.some((s) => s.name === name),
      );
      const compulsory = listing.every(
        (x) => x.subjects.find((s) => s.name === name)!.compulsory,
      );
      add(
        name,
        compulsory ? ClassSubjectType.COMPULSORY : ClassSubjectType.OPTIONAL,
        listing.length === 1 ? listing[0].name : null,
      );
    }
  }
  return [...out.values()];
}
