/**
 * What the signed-in member may open, for hiding menus and widgets. Only a
 * hint for the UI: every backend endpoint checks its own permission.
 */
export interface Permissions {
  /** School admins pass every check (as on the backend). */
  isAdmin: boolean
  keys: ReadonlySet<string>
}

export const NO_PERMISSIONS: Permissions = { isAdmin: false, keys: new Set() }

/** From `GET /auth/me`. */
export function toPermissions(
  me: { isAdmin: boolean; permissions: string[] } | null | undefined
): Permissions {
  if (!me) return NO_PERMISSIONS
  return { isAdmin: me.isAdmin, keys: new Set(me.permissions) }
}

/** Whether the member holds `key` (`students:read`). */
export const can = (permissions: Permissions, key: string) =>
  permissions.isAdmin || permissions.keys.has(key)

/** Whether the member holds at least one of `keys`. */
export const canAny = (permissions: Permissions, keys: readonly string[]) =>
  permissions.isAdmin || keys.some((key) => permissions.keys.has(key))

/**
 * What a menu item or widget asks for: one key, any of several, school
 * admins only, or (neither) every staff member.
 */
export interface Requirement {
  permission?: string | readonly string[]
  adminOnly?: boolean
}

export function allows(permissions: Permissions, need: Requirement): boolean {
  if (need.adminOnly && !permissions.isAdmin) return false
  if (need.permission === undefined) return true
  return typeof need.permission === "string"
    ? can(permissions, need.permission)
    : canAny(permissions, need.permission)
}
