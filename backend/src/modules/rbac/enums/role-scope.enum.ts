/**
 * How far a role's permissions reach. `school` covers the whole school;
 * `assigned` limits them to the sections and subjects the holder teaches in
 * the current session (see `AccessScope`). A user's scope for a key is the
 * widest among the roles that grant it.
 */
export enum RoleScope {
  SCHOOL = 'school',
  ASSIGNED = 'assigned',
}
