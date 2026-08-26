import { Controller, Get, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { AdminOverviewDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Số liệu tổng quan khu Quản trị. `user.read` — instructor KHÔNG có quyền này. */
  @Get('overview')
  @RequirePermission(PERMISSIONS.USER_READ)
  overview(): Promise<AdminOverviewDto> {
    return this.admin.getOverview();
  }
}
