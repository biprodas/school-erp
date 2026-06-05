/** Permission catalog shapes, mirroring the NestJS `getPermissionCatalog()` output. */

export interface PermissionItem {
  /** Full permission key, e.g. "students:read". */
  key: string;
  /** Action portion of the key, e.g. "read". */
  action: string;
}

export interface PermissionGroup {
  /** Resource portion of the key, e.g. "students". */
  resource: string;
  permissions: PermissionItem[];
}
