import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { StudentService } from '~/modules/students/services/student.service';
import { OrganizationService } from '~/modules/organizations/services/organization.service';
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

/** What switching took out of the previous template. */
export interface RemovedCounts {
  classes: number;
  subjects: number;
  subjectGroups: number;
  classSubjects: number;
}

const noneRemoved = (): RemovedCounts => ({
  classes: 0,
  subjects: 0,
  subjectGroups: 0,
  classSubjects: 0,
});

export interface SwitchResult extends ApplyResult {
  /** The template replaced, or null when there was none. */
  previous: string | null;
  removed: RemovedCounts;
}

function findCurriculumTemplate(code: string): CurriculumTemplate {
  const template = CURRICULUM_TEMPLATES.find((t) => t.code === code);
  if (!template) {
    throw new NotFoundException({
      message: 'Template not found',
      code: 'TEMPLATE_NOT_FOUND',
    });
  }
  return template;
}

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
    private readonly organizations: OrganizationService,
    private readonly students: StudentService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  /** What onboarding can offer, and the curriculum template in use. */
  async list() {
    return {
      curriculumInUse: await this.organizations.getCurriculumTemplate(
        this.ds.orgId,
      ),
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
    const template = findCurriculumTemplate(code);
    await this.assertOnlyTemplate(template.code);
    const year = await this.yearFor(academicYearId);
    const applied = await this.ds.runInTransaction(() =>
      this.addTemplate(template, year?.id ?? null),
    );
    await this.organizations.setCurriculumTemplate(
      this.ds.orgId,
      template.code,
    );
    return applied;
  }

  /**
   * Replaces the template in use with `code`, in one transaction: the old
   * template's classes, subjects and groups that the new one doesn't have
   * are removed (classes with their sections and fee structures), classes
   * both have lose the old template's subjects and groups, then the new
   * template is added. Classes and subjects the school made itself stay.
   * Refused once the school has students; with no template in use (or the
   * same one) it is a plain apply.
   */
  async switchCurriculum(
    code: string,
    academicYearId?: string,
  ): Promise<SwitchResult> {
    const template = findCurriculumTemplate(code);
    const inUse = await this.organizations.getCurriculumTemplate(this.ds.orgId);
    const previous = CURRICULUM_TEMPLATES.find((t) => t.code === inUse);
    if (!previous || previous.code === template.code) {
      return {
        ...(await this.applyCurriculum(code, academicYearId)),
        previous: null,
        removed: noneRemoved(),
      };
    }
    const students = await this.students.findFiltered({ page: 1, limit: 1 });
    if (students.meta.total > 0) {
      throw new ConflictException({
        message:
          'The school has students; its curriculum template can no longer be switched',
        code: 'CURRICULUM_SWITCH_HAS_STUDENTS',
      });
    }
    const year = await this.yearFor(academicYearId);

    const switched = await this.ds.runInTransaction(async () => {
      const removed = await this.removeTemplate(previous, template);
      const applied = await this.addTemplate(template, year?.id ?? null, {
        template: previous.code,
        removed,
      });
      return { ...applied, previous: previous.code, removed };
    });
    await this.organizations.setCurriculumTemplate(
      this.ds.orgId,
      template.code,
    );
    return switched;
  }

  private yearFor(academicYearId?: string) {
    return academicYearId
      ? this.academicYears.findById(academicYearId)
      : this.academicYears.findCurrent();
  }

  /** Adds what the template has and the school doesn't; call in a transaction. */
  private async addTemplate(
    template: CurriculumTemplate,
    academicYearId: string | null,
    replaced?: { template: string; removed: RemovedCounts },
  ): Promise<ApplyResult> {
    const result: ApplyResult = {
      template: template.code,
      academicYearId,
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
    if (academicYearId) {
      await this.ensureCurriculum(
        template,
        academicYearId,
        { subjectIds, classIds, groupIds },
        result,
      );
    }
    await this.audit.record({
      action: AUDIT_ACTIONS.TEMPLATE_APPLIED,
      entityType: 'template',
      entityId: template.code,
      before: replaced,
      after: { ...result.created, academicYearId },
    });
    return result;
  }

  /**
   * Takes out what `previous` added that `next` doesn't have, matched like
   * applying matches (by name, subjects also by code). Call in a
   * transaction: a row still in use (exam marks, …) fails the whole switch.
   */
  private async removeTemplate(
    previous: CurriculumTemplate,
    next: CurriculumTemplate,
  ): Promise<RemovedCounts> {
    const removed = noneRemoved();
    const names = (items: { name: string }[]) =>
      new Set(items.map((i) => key(i.name)));
    const nextClasses = names(next.classes);
    const nextSubjects = names(next.subjects);
    const nextGroups = names(next.groups);
    const oldClasses = names(previous.classes);
    const oldSubjects = names(previous.subjects);
    const oldCodes = new Set(
      previous.subjects.flatMap((s) => (s.code ? [s.code] : [])),
    );
    const oldGroups = names(previous.groups);

    const subjects = (await all((q) => this.subjects.findFiltered(q))).filter(
      (s) => oldSubjects.has(key(s.name)) || (s.code && oldCodes.has(s.code)),
    );
    const subjectIds = new Set(subjects.map((s) => s.id));
    const groups = (
      await all((q) => this.subjectGroups.findFiltered(q))
    ).filter((g) => oldGroups.has(key(g.name)));
    const groupIds = new Set(groups.map((g) => g.id));

    const classes = (await all((q) => this.classes.findFiltered(q))).filter(
      (c) => oldClasses.has(key(c.name)),
    );
    for (const c of classes) {
      if (!nextClasses.has(key(c.name))) {
        await this.classes.remove(c.id);
        removed.classes++;
        continue;
      }
      // Kept for the new template, which adds its own subjects and groups.
      const offered = await all((q) =>
        this.classSubjects.findFiltered({ ...q, classId: c.id }),
      );
      for (const cs of offered.filter((x) => subjectIds.has(x.subjectId))) {
        await this.classSubjects.remove(cs.id);
        removed.classSubjects++;
      }
      const grouped = await all((q) =>
        this.classSubjectGroups.findFiltered({ ...q, classId: c.id }),
      );
      for (const cg of grouped.filter((x) => groupIds.has(x.subjectGroupId))) {
        await this.classSubjectGroups.remove(cg.id);
      }
    }
    for (const s of subjects) {
      if (nextSubjects.has(key(s.name))) continue;
      await this.subjects.remove(s.id);
      removed.subjects++;
    }
    for (const g of groups) {
      if (nextGroups.has(key(g.name))) continue;
      await this.subjectGroups.remove(g.id);
      removed.subjectGroups++;
    }
    return removed;
  }

  /**
   * A school uses one curriculum template. Another is refused while the
   * school has classes (switching replaces it instead); with none left, it
   * may start over with another.
   */
  private async assertOnlyTemplate(code: string): Promise<void> {
    const inUse = await this.organizations.getCurriculumTemplate(this.ds.orgId);
    if (!inUse || inUse === code) return;
    const classes = await this.classes.findFiltered({ page: 1, limit: 1 });
    if (classes.meta.total === 0) return;
    throw new ConflictException({
      message: `The school uses the "${inUse}" curriculum template; only one can be applied`,
      code: 'CURRICULUM_TEMPLATE_IN_USE',
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
