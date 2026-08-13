// Vai trò hệ thống, khóa permission, và hợp đồng RBAC dùng chung. Nguồn: docs/DESIGN.md §2, §5.1.

export const SYSTEM_ROLES = [
  'super_admin',
  'admin',
  'instructor',
  'teaching_assistant',
  'student',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** Khóa permission dạng "<resource>.<action>". Guard kiểm theo khóa này (PBAC), không kiểm role thô. */
export type PermissionKey = string;

/**
 * Catalog permission P0 — nguồn sự thật để seed (T0.7) và tham chiếu ở guard/controller.
 * Mở rộng theo phase (course.*, class.*, grade.*, ...).
 */
export const PERMISSIONS = {
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  ROLE_READ: 'role.read',
  ROLE_CREATE: 'role.create',
  ROLE_ASSIGN: 'role.assign',
  PERMISSION_READ: 'permission.read',
  // P1 — Course & Class
  COURSE_READ: 'course.read',
  COURSE_CREATE: 'course.create',
  COURSE_UPDATE: 'course.update',
  COURSE_PUBLISH: 'course.publish',
  COURSE_DELETE: 'course.delete',
  CLASS_READ: 'class.read',
  CLASS_CREATE: 'class.create',
  CLASS_UPDATE: 'class.update',
  CLASS_MANAGE: 'class.manage', // gán khóa, enroll thành viên, mở/tắt gate bài
  CLASS_DELETE: 'class.delete',
} as const;

export type PermissionCatalogKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// --- Hợp đồng quản lý RBAC ---

export interface PermissionSummary {
  id: string;
  key: string;
  description?: string | null;
}

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface CreateRoleRequest {
  key: string;
  name: string;
  description?: string;
}

export interface AssignRoleRequest {
  roleKey: string;
  classId?: string | null;
}

export interface AttachPermissionRequest {
  permissionKey: string;
}
