/** Who a notice is for (PRD 6.13 targeting). */
export type AudienceType =
  | 'all'
  | 'staff'
  | 'guardians'
  | 'students'
  | 'role'
  | 'class'
  | 'section'
  | 'group'
  | 'users';

export const AUDIENCE_TYPES: readonly AudienceType[] = [
  'all',
  'staff',
  'guardians',
  'students',
  'role',
  'class',
  'section',
  'group',
  'users',
];

export interface Audience {
  type: AudienceType;
  /** Role, class, section, subject-group or user ids, by `type`. */
  ids: string[];
}

/** What decides which notices a signed-in user sees. */
export interface Viewer {
  userId: string;
  roleIds: string[];
  /** Holds only portal roles. */
  portalOnly: boolean;
  isGuardian: boolean;
  isStudent: boolean;
  /** Staff: sections taught; portal: the children's (or own) sections. */
  sectionIds: string[];
  classIds: string[];
  /** Subject groups (Science, …) of the children's (or own) enrollments. */
  groupIds: string[];
}

const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));

/** Whether a notice's audience includes the viewer. */
export function inAudience(audience: Audience, viewer: Viewer): boolean {
  switch (audience.type) {
    case 'all':
      return true;
    case 'staff':
      return !viewer.portalOnly;
    case 'guardians':
      return viewer.isGuardian;
    case 'students':
      return viewer.isStudent;
    case 'role':
      return overlaps(audience.ids, viewer.roleIds);
    case 'class':
      return overlaps(audience.ids, viewer.classIds);
    case 'section':
      return overlaps(audience.ids, viewer.sectionIds);
    case 'group':
      return overlaps(audience.ids, viewer.groupIds);
    case 'users':
      return audience.ids.includes(viewer.userId);
  }
}
