import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS, type Paginated, type SubmissionDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { SubmissionsService } from './submissions.service';
import { SaveSubmissionDto } from './dto/save-submission.dto';
import { SubmitSubmissionDto } from './dto/submit-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { QuerySubmissionsDto } from './dto/query-submissions.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Put('assignments/:assignmentId/submissions/save')
  saveDraft(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SaveSubmissionDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<SubmissionDto> {
    return this.submissionsService.saveDraft(assignmentId, user.userId, dto);
  }

  @Post('assignments/:assignmentId/submissions/submit')
  submit(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitSubmissionDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<SubmissionDto> {
    return this.submissionsService.submit(assignmentId, user.userId, dto);
  }

  @Get('assignments/:assignmentId/submissions/mine')
  getMySubmission(
    @Param('assignmentId') assignmentId: string,
    @Query('classId') classId: string,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<SubmissionDto | null> {
    return this.submissionsService.getMySubmission(assignmentId, classId, user.userId);
  }

  @Get('classes/:classId/assignments/:assignmentId/submissions')
  @RequirePermission(PERMISSIONS.SUBMISSION_READ)
  listForClassAssignment(
    @Param('classId') classId: string,
    @Param('assignmentId') assignmentId: string,
    @Query() query: QuerySubmissionsDto,
  ): Promise<Paginated<SubmissionDto>> {
    return this.submissionsService.listForClassAssignment(classId, assignmentId, query);
  }

  @Get('submissions/:id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<SubmissionDto> {
    return this.submissionsService.findOne(id, user);
  }

  @Put('submissions/:id/grade')
  @RequirePermission(PERMISSIONS.GRADE_WRITE)
  grade(
    @Param('id') id: string,
    @Body() dto: GradeSubmissionDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<SubmissionDto> {
    return this.submissionsService.grade(id, dto, user);
  }
}
