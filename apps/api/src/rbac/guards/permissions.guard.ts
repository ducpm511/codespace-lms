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
 * PBAC guard. Chạy SAU JwtAuthGuard (cần req.user). Đọc permission yêu cầu từ @RequirePermission,
 * đối chiếu quyền hiệu lực của user (global + scope lớp lấy từ classId trong request).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true; // route không yêu cầu permission cụ thể
    }

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Chưa xác thực');
    }

    const classId = extractClassId(req);
    const eff = await this.rbac.getEffectivePermissions(req.user.userId);
    const ok = required.every((key) => this.rbac.hasPermission(eff, key, classId));
    if (!ok) {
      throw new ForbiddenException('Không đủ quyền thực hiện thao tác này');
    }
    return true;
  }
}

/** Lấy classId gắn với request (ưu tiên params → body → query) để chấm quyền theo phạm vi lớp. */
function extractClassId(req: AuthenticatedRequest): string | undefined {
  const params = req.params as Record<string, unknown> | undefined;
  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, unknown> | undefined;
  const raw = params?.classId ?? body?.classId ?? query?.classId;
  return typeof raw === 'string' ? raw : undefined;
}
