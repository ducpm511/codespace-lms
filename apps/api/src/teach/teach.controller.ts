import { Controller, Get, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { TeachOverviewDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { TeachService } from './teach.service';

@Controller('teach')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeachController {
  constructor(private readonly teach: TeachService) {}

  /** Hero khu Giảng dạy. Phạm vi lấy từ principal, KHÔNG nhận classId từ client. */
  @Get('overview')
  @RequirePermission(PERMISSIONS.CLASS_READ)
  overview(@CurrentUser() user: AuthPrincipal): Promise<TeachOverviewDto> {
    return this.teach.getOverview(user.userId);
  }
}
