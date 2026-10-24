import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Paginated } from '~/common/dto/paginated.dto';
import { TENANT_DATASOURCE } from '~/tenancy/tenancy.constants';
import { TenantDataSourceProxy } from '~/tenancy/tenant-datasource.proxy';
import { AuditService } from '~/modules/audit/services/audit.service';
import { GradingService } from '~/modules/grading/services/grading.service';
import { AUDIT_ACTIONS } from '~/modules/audit/audit-actions';
import { SettingsService } from '~/modules/settings/services/settings.service';
import { AcademicYearService } from '~/modules/academic-years/academic-year.service';
import { ClassService } from '~/modules/classes/class.service';
import { SectionService } from '~/modules/sections/section.service';
import { ClassSubjectService } from '~/modules/class-curriculum/services/class-subject.service';
import { EmployeeService } from '~/modules/employees/employee.service';
import { StudentService } from '~/modules/students/services/student.service';
import { OrgUserService } from '~/modules/users/services/org-user.service';
import { OrganizationService } from '~/modules/organizations/services/organization.service';

export type OnboardingStepKey =
  | 'profile'
  | 'session'
  | 'classes'
  | 'curriculum'
  | 'grading'
  | 'fees'
  | 'staff'
  | 'students';

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  /** Frontend path of the screen that completes it. */
  link: string;
  /** Needed before `POST /onboarding/complete`. */
  required: boolean;
  /** False until the feature behind the step exists (fees M6). */
  available: boolean;
  done: boolean;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  /** Done steps out of the available ones, 0–100. */
  percentage: number;
  /** Every required step is done, so the school can complete onboarding. */
  canComplete: boolean;
  completedAt: Date | null;
}

type StepDefinition = Omit<OnboardingStep, 'done'>;

/** The wizard of PRD 6.2, in order. */
const STEPS: StepDefinition[] = [
  {
    key: 'profile',
    title: 'School profile',
    link: '/settings/profile',
    required: true,
    available: true,
  },
  {
    key: 'session',
    title: 'Academic session',
    link: '/academic/sessions',
    required: true,
    available: true,
  },
  {
    key: 'classes',
    title: 'Classes and sections',
    link: '/academic/classes',
    required: true,
    available: true,
  },
  {
    key: 'curriculum',
    title: 'Subjects for each class',
    link: '/academic/class-subjects',
    required: true,
    available: true,
  },
  {
    key: 'grading',
    title: 'Grading system',
    link: '/exams/grading',
    required: false,
    available: true,
  },
  {
    key: 'fees',
    title: 'Fee heads',
    link: '/fees/heads',
    required: false,
    available: false,
  },
  {
    key: 'staff',
    title: 'Add and invite staff',
    link: '/hr/employees',
    required: false,
    available: true,
  },
  {
    key: 'students',
    title: 'Import students',
    link: '/students',
    required: false,
    available: true,
  },
];

const ONE = { page: 1, limit: 1 };

const total = async (page: Promise<Paginated<unknown>>) =>
  (await page).meta.total;

/**
 * The setup checklist (PRD 6.2): each step is computed from the school's
 * real data, so it stays right however the data got there (wizard, import,
 * template, API). `complete`/`skip` set `organizations.onboarding_completed_at`,
 * which the frontend's onboarding gate reads from `GET /auth/me`.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly settings: SettingsService,
    private readonly academicYears: AcademicYearService,
    private readonly classes: ClassService,
    private readonly sections: SectionService,
    private readonly classSubjects: ClassSubjectService,
    private readonly employees: EmployeeService,
    private readonly students: StudentService,
    private readonly members: OrgUserService,
    private readonly organizations: OrganizationService,
    private readonly grading: GradingService,
    private readonly audit: AuditService,
    @Inject(TENANT_DATASOURCE) private readonly ds: TenantDataSourceProxy,
  ) {}

  async checklist(): Promise<OnboardingChecklist> {
    const done = await this.doneSteps();
    const steps = STEPS.map((s) => ({ ...s, done: done.has(s.key) }));
    const available = steps.filter((s) => s.available);
    const completedAt = await this.organizations.getOnboardingCompletedAt(
      this.ds.orgId,
    );
    return {
      steps,
      percentage: Math.round(
        (available.filter((s) => s.done).length / available.length) * 100,
      ),
      canComplete: steps.every((s) => !s.required || s.done),
      completedAt,
    };
  }

  /** Finishes onboarding; every required step must be done. */
  async complete(): Promise<OnboardingChecklist> {
    const checklist = await this.checklist();
    const missing = checklist.steps
      .filter((s) => s.required && !s.done)
      .map((s) => s.key);
    if (missing.length) {
      throw new ConflictException({
        message: 'Finish the required setup steps first',
        code: 'ONBOARDING_INCOMPLETE',
        missing,
      });
    }
    await this.finish(AUDIT_ACTIONS.ONBOARDING_COMPLETED, checklist);
    return this.checklist();
  }

  /** Leaves the wizard now; the checklist stays available. */
  async skip(): Promise<OnboardingChecklist> {
    await this.finish(AUDIT_ACTIONS.ONBOARDING_SKIPPED, await this.checklist());
    return this.checklist();
  }

  /**
   * Audit row first, on the tenant transaction; the flag (root connection)
   * is written inside it, so a failed flag write rolls the row back.
   */
  private async finish(
    action:
      | typeof AUDIT_ACTIONS.ONBOARDING_COMPLETED
      | typeof AUDIT_ACTIONS.ONBOARDING_SKIPPED,
    checklist: OnboardingChecklist,
  ): Promise<void> {
    if (checklist.completedAt) return;
    await this.ds.runInTransaction(async () => {
      await this.audit.record({
        action,
        entityType: 'organization',
        entityId: this.ds.orgId,
        after: { percentage: checklist.percentage },
      });
      await this.organizations.setOnboardingCompleted(
        this.ds.orgId,
        new Date(),
      );
    });
  }

  private async doneSteps(): Promise<Set<OnboardingStepKey>> {
    const done = new Set<OnboardingStepKey>();
    const profile = await this.settings.getSection('profile');
    if (
      (profile.address.line1 || profile.address.district) &&
      (profile.phone || profile.email)
    ) {
      done.add('profile');
    }

    const current = await this.academicYears.findCurrent();
    if (current) done.add('session');

    // Sections belong to a session: count the current one's.
    const classCount = await total(this.classes.findFiltered(ONE));
    const sectionCount = current
      ? await this.sections.countInYear(current.id)
      : 0;
    if (classCount > 0 && sectionCount > 0) done.add('classes');

    if (
      current &&
      (await total(
        this.classSubjects.findFiltered({ ...ONE, academicYearId: current.id }),
      )) > 0
    ) {
      done.add('curriculum');
    }

    const [employeeCount, memberCount] = await Promise.all([
      total(this.employees.findFiltered(ONE)),
      this.members.countMembers(),
    ]);
    // Anyone besides the owner: an employee record or an invited member.
    if (employeeCount > 0 || memberCount > 1) done.add('staff');

    if ((await total(this.students.findFiltered(ONE))) > 0) {
      done.add('students');
    }
    if ((await this.grading.findAll()).length > 0) done.add('grading');
    return done;
  }
}
