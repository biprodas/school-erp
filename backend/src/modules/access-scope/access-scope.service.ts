import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import { PermissionKey } from '~/modules/rbac/permissions.catalog';
import { RoleScope } from '~/modules/rbac/enums/role-scope.enum';
import { PermissionResolverService } from '~/modules/rbac/services/permission-resolver.service';
import {
  ClassSectionRef,
  SubjectAssignmentRef,
  TeachingAssignments,
  TeachingService,
} from '~/modules/teaching/services/teaching.service';

/**
 * What the current user may reach with a permission (PRD 6.3 scope rules).
 * Endpoints that read or write section or subject data call it after
 * `PermissionsGuard` and filter by the answer:
 *
 * - `null`: unrestricted (school admin, or a role with `school` scope grants
 *   the key).
 * - a list: only these class-sections / subjects; empty when the key is not
 *   held at all or the holder teaches nothing in the current session.
 *
 * Request-scoped; roles and assignments are read once per request.
 */
@Injectable()
export class AccessScope {
  private scopes?: Promise<Map<string, RoleScope>>;
  private assignments?: Promise<TeachingAssignments>;

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly resolver: PermissionResolverService,
    private readonly teachingService: TeachingService,
  ) {}

  async can(key: PermissionKey): Promise<boolean> {
    if (this.isAdmin) return true;
    return (await this.scopeOf(key)) !== undefined;
  }

  /**
   * Class-sections reachable with `key`: those the user is class teacher of
   * plus those they teach a subject in.
   */
  async sections(key: PermissionKey): Promise<ClassSectionRef[] | null> {
    const assigned = await this.assignedFor(key);
    if (assigned === null) return null;
    const unique = new Map<string, ClassSectionRef>();
    for (const ref of [...assigned.classSections, ...assigned.subjects]) {
      unique.set(`${ref.classId}:${ref.sectionId}`, {
        classId: ref.classId,
        sectionId: ref.sectionId,
      });
    }
    return [...unique.values()];
  }

  /** Subjects (per class-section) reachable with `key`. */
  async subjectAssignments(
    key: PermissionKey,
  ): Promise<SubjectAssignmentRef[] | null> {
    const assigned = await this.assignedFor(key);
    return assigned === null ? null : assigned.subjects;
  }

  /** Whether `key` reaches one class-section. */
  async canAccessSection(
    key: PermissionKey,
    ref: ClassSectionRef,
  ): Promise<boolean> {
    const sections = await this.sections(key);
    return (
      sections === null ||
      sections.some(
        (s) => s.classId === ref.classId && s.sectionId === ref.sectionId,
      )
    );
  }

  /** Whether `key` reaches one subject of a class-section. */
  async canAccessSubject(
    key: PermissionKey,
    ref: SubjectAssignmentRef,
  ): Promise<boolean> {
    const subjects = await this.subjectAssignments(key);
    return (
      subjects === null ||
      subjects.some(
        (s) =>
          s.classId === ref.classId &&
          s.sectionId === ref.sectionId &&
          s.subjectId === ref.subjectId,
      )
    );
  }

  /** `null` when unrestricted, else the assignments that bound `key`. */
  private async assignedFor(
    key: PermissionKey,
  ): Promise<TeachingAssignments | null> {
    if (this.isAdmin) return null;
    const scope = await this.scopeOf(key);
    if (scope === RoleScope.SCHOOL) return null;
    if (scope === undefined) return { classSections: [], subjects: [] };
    this.assignments ??= this.teachingService.activeAssignmentsForUser(
      this.userId,
    );
    return this.assignments;
  }

  private async scopeOf(key: PermissionKey): Promise<RoleScope | undefined> {
    this.scopes ??= this.resolver.getPermissionScopes(this.userId);
    return (await this.scopes).get(key);
  }

  private get isAdmin(): boolean {
    return this.request.user?.isAdmin === true;
  }

  private get userId(): string {
    const userId = this.request.user?.userId;
    if (!userId) {
      // Only reachable when a handler forgot JwtAuthGuard.
      throw new Error('AccessScope used without an authenticated user');
    }
    return userId;
  }
}
