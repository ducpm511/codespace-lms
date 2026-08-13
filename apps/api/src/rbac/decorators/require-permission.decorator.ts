import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@lms/contracts';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Gắn permission cần có cho route (PBAC). Nhiều key = phải có ĐỦ tất cả (AND).
 * Dùng kèm JwtAuthGuard + PermissionsGuard:
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *   @RequirePermission('course.create')
 */
export const RequirePermission = (...keys: PermissionKey[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, keys);
