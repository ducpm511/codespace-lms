import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { BadgeDto, ManualAwardResultDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal, AuthenticatedRequest } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { GamificationService } from './gamification.service';
import { ManualAwardDto } from './dto/manual-award.dto';

@Controller('gamification')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('me')
  getMyGamification(@CurrentUser() user: AuthPrincipal) {
    return this.gamificationService.getProfile(user.userId);
  }

  /** Danh sách huy hiệu giáo viên trao tay được — để dựng ô chọn ở màn hình chấm bài. */
  @Get('manual-badges')
  @RequirePermission(PERMISSIONS.GRADE_WRITE)
  listManualBadges(): Promise<BadgeDto[]> {
    return this.gamificationService.listManualBadges();
  }

  /**
   * Giáo viên trao huy hiệu / thưởng XP cho một học viên (T10.3).
   *
   * Route không có `:classId` nên PermissionsGuard KHÔNG chấm được theo lớp — `@RequirePermission`
   * ở đây chỉ lọc thô. Phạm vi lớp thật sự kiểm trong service theo `body.classId`
   * (`assertCanAwardInClass`): phải là instructor/ta của chính lớp đó.
   */
  @Post('students/:studentId/awards')
  @RequirePermission(PERMISSIONS.GRADE_WRITE)
  awardManually(
    @Param('studentId') studentId: string,
    @Body() dto: ManualAwardDto,
    @CurrentUser() principal: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ManualAwardResultDto> {
    return this.gamificationService.awardManually(studentId, dto, {
      userId: principal.userId,
      ip: req.ip,
    });
  }
}
