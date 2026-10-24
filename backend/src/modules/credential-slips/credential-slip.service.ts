import { Injectable } from '@nestjs/common';
import { AppHosts } from '~/shared/hosts/app-hosts';
import { QUEUES } from '~/shared/queue';
import { InviteService } from '~/modules/auth/services/invite.service';
import { EnrollmentService } from '~/modules/enrollments/services/enrollment.service';
import { GuardianService } from '~/modules/guardians/services/guardian.service';
import type { Job } from '~/modules/jobs/entities/job.entity';
import { JobService } from '~/modules/jobs/services/job.service';
import { SectionService } from '~/modules/sections/section.service';
import { SlipAudience } from './dto/credential-slips.dto';

export const CREDENTIAL_SLIPS_JOB = 'credential-slips';

export interface CredentialSlipsJobData {
  sectionId: string;
  audience: SlipAudience;
  includeEmailAccounts: boolean;
}

export interface Slip {
  kind: 'guardian' | 'student';
  name: string;
  /** The children in this section (guardian slips). */
  students: string[];
  rollNo: string | null;
  identifier: string;
  password: string;
}

export interface SlipSkip {
  kind: 'guardian' | 'student';
  name: string;
  reason: 'own_password' | 'has_email' | 'no_account';
}

/**
 * Printed sign-in slips for a section's guardians and students (PRD 6.3):
 * each slip carries the login (phone, or email) and a fresh temporary
 * password that must be changed at first sign-in. Printing again replaces
 * older slips. Accounts whose owner chose a password are never touched.
 */
@Injectable()
export class CredentialSlipService {
  constructor(
    private readonly sections: SectionService,
    private readonly enrollments: EnrollmentService,
    private readonly guardians: GuardianService,
    private readonly invites: InviteService,
    private readonly jobs: JobService,
    private readonly hosts: AppHosts,
  ) {}

  async start(
    sectionId: string,
    data: Omit<CredentialSlipsJobData, 'sectionId'>,
  ): Promise<Job> {
    await this.sections.findById(sectionId);
    return this.jobs.start<CredentialSlipsJobData>({
      type: 'users.credential_slips',
      queue: QUEUES.pdf,
      name: CREDENTIAL_SLIPS_JOB,
      data: { sectionId, ...data },
      // A retry would issue new passwords and void the first ones.
      options: { attempts: 1 },
    });
  }

  /** Issues the passwords and returns the slips (the job's work). */
  async build(data: CredentialSlipsJobData, orgSlug: string) {
    const section = await this.sections.findById(data.sectionId);
    const rows = await this.enrollments.findActiveInSection(section.id);
    const wantGuardians = data.audience !== SlipAudience.STUDENTS;
    const wantStudents = data.audience !== SlipAudience.GUARDIANS;

    // People in print order: by roll, a guardian once for all their children.
    const people: {
      kind: Slip['kind'];
      userId: string | null;
      name: string;
      students: string[];
      rollNo: string | null;
    }[] = [];
    if (wantGuardians) {
      const links = await this.guardians.linksForStudents(
        rows.map((r) => r.studentId),
      );
      const byGuardian = new Map<string, (typeof people)[number]>();
      for (const row of rows) {
        for (const link of links.filter((l) => l.studentId === row.studentId)) {
          const g = link.guardian;
          if (!g) continue;
          const seen = byGuardian.get(g.id);
          if (seen) {
            seen.students.push(row.student.fullName);
            continue;
          }
          const person = {
            kind: 'guardian' as const,
            userId: g.userId,
            name: g.name,
            students: [row.student.fullName],
            rollNo: row.rollNo,
          };
          byGuardian.set(g.id, person);
          people.push(person);
        }
      }
    }
    if (wantStudents) {
      for (const row of rows) {
        people.push({
          kind: 'student',
          userId: row.student.userId,
          name: row.student.fullName,
          students: [],
          rollNo: row.rollNo,
        });
      }
    }

    const outcomes = await this.invites.issueSlips(
      people.flatMap((p) => (p.userId ? [p.userId] : [])),
      { includeEmailAccounts: data.includeEmailAccounts },
    );
    const slips: Slip[] = [];
    const skipped: SlipSkip[] = [];
    for (const p of people) {
      const outcome = p.userId ? outcomes.get(p.userId) : undefined;
      if (!outcome) {
        skipped.push({ kind: p.kind, name: p.name, reason: 'no_account' });
      } else if (outcome.status === 'issued') {
        slips.push({
          kind: p.kind,
          name: p.name,
          students: p.students,
          rollNo: p.rollNo,
          identifier: outcome.identifier,
          password: outcome.temporaryPassword,
        });
      } else {
        skipped.push({ kind: p.kind, name: p.name, reason: outcome.status });
      }
    }
    return {
      section,
      slips,
      skipped,
      signInUrl: this.hosts.url(this.hosts.schoolHost(orgSlug), '/login'),
    };
  }
}
