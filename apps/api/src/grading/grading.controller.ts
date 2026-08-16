import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PERMISSIONS, type ClassGradebookDto, type StudentOwnGradebookDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '@lms/contracts';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { GradingService } from './grading.service';

@Controller('classes')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Get(':classId/gradebook')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.GRADE_READ)
  getClassGradebook(
    @Param('classId') classId: string,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<ClassGradebookDto> {
    return this.gradingService.getClassGradebook(classId, currentUser);
  }

  @Get(':classId/my-gradebook')
  @UseGuards(JwtAuthGuard)
  getStudentOwnGradebook(
    @Param('classId') classId: string,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<StudentOwnGradebookDto> {
    return this.gradingService.getStudentOwnGradebook(classId, currentUser);
  }
}
