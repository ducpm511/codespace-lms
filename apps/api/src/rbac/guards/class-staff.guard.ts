import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { RbacService } from '../rbac.service';
import type { AuthenticatedRequest } from '../../auth/auth.types';

/**
 * Chặn thao tác GHI ở lớp mà người gọi không phụ trách. Đặt trên route có `:classId`, sau PermissionsGuard,
 * dùng lại các quyền khai ở `@RequirePermission` của route đó.
 *
 * PermissionsGuard không đủ: role `instructor` gán global nên GV nào cũng qua ở mọi lớp (INVARIANT #3).
 * ĐỌC thì không dùng guard này: GV được xem mọi lớp (người dùng chốt 04/11, ACTIVE_TASKS C4).
 */
@Injectable()
export class ClassStaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Chưa xác thực');
    }

    // Thiếu classId hoặc thiếu @RequirePermission là lỗi khai báo route: từ chối thay vì cho qua.
    const classId = (req.params as Record<string, unknown> | undefined)?.classId;
    if (typeof classId !== 'string' || !required || required.length === 0) {
      throw new ForbiddenException('Bạn không phụ trách lớp này');
    }
    if (!(await this.rbac.isClassStaff(req.user.userId, classId, required))) {
      throw new ForbiddenException('Bạn không phụ trách lớp này');
    }
    return true;
  }
}
