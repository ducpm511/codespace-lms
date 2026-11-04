import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type {
  ClassCodingOverviewDto,
  ClassCodingProblemSubmissionsDto,
  CodingSubmissionDto,
  CodingSubmissionReviewDto,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CodingService } from './coding.service';

/**
 * Đọc kết quả một submission. KHÔNG @RequirePermission: route không có :classId nên scope được kiểm
 * trong service theo submission.classId (chủ sở hữu, hoặc GV/TA có coding.result.read của lớp đó).
 */
@Controller('coding-submissions')
@UseGuards(JwtAuthGuard)
export class CodingSubmissionsController {
  constructor(private readonly coding: CodingService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<CodingSubmissionDto> {
    return this.coding.getSubmission(id, user);
  }

  // Giáo viên đọc code + kết quả từng test của một lần nộp; quyền kiểm theo lớp của chính bài nộp.
  @Get(':id/review')
  review(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<CodingSubmissionReviewDto> {
    return this.coding.getSubmissionReview(id, user.userId);
  }
}

/**
 * Giáo viên xem bài nộp theo lớp. `@RequirePermission` chỉ lọc thô (role `student` cũng có quyền này);
 * chỗ chặn thật là `assertCanReviewSubmissions` trong service (INVARIANT #3).
 */
@Controller('classes/:classId/coding-submissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(PERMISSIONS.CODING_RESULT_READ)
export class ClassCodingSubmissionsController {
  constructor(private readonly coding: CodingService) {}

  @Get()
  overview(@Param('classId') classId: string, @CurrentUser() user: AuthPrincipal): Promise<ClassCodingOverviewDto> {
    return this.coding.getClassCodingOverview(classId, user.userId);
  }

  @Get(':problemId')
  forProblem(
    @Param('classId') classId: string,
    @Param('problemId') problemId: string,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ClassCodingProblemSubmissionsDto> {
    return this.coding.getClassProblemSubmissions(classId, problemId, user.userId);
  }
}
