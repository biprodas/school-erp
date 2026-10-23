import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessScope } from '~/modules/access-scope/access-scope.service';
import type { PermissionKey } from '~/modules/rbac/permissions.catalog';
import { StudentService } from './student.service';

/**
 * Scope rules for student data (PRD 6.3): a teacher with assigned scope
 * reaches the students enrolled in the sections they teach. Every
 * endpoint under `/students/:id` checks it after `PermissionsGuard`.
 */
@Injectable()
export class StudentScope {
  constructor(
    private readonly scope: AccessScope,
    private readonly students: StudentService,
  ) {}

  /** `null` = every student; else the sections that bound `key`. */
  sections(key: PermissionKey): Promise<string[] | null> {
    return this.scope.sections(key);
  }

  /** 404 (same as a missing student) when `key` doesn't reach the student. */
  async assert(key: PermissionKey, studentId: string): Promise<void> {
    await this.students.findById(studentId);
    const allowed = await this.scope.sections(key);
    if (allowed === null) return;
    if (!(await this.students.isInSections(studentId, allowed))) {
      throw new NotFoundException(`Student with id "${studentId}" not found`);
    }
  }

  /** Like `assert`, passing when any of the keys reaches the student. */
  async assertAny(keys: PermissionKey[], studentId: string): Promise<void> {
    let lastError: unknown;
    for (const key of keys) {
      try {
        return await this.assert(key, studentId);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  can(key: PermissionKey): Promise<boolean> {
    return this.scope.can(key);
  }
}
