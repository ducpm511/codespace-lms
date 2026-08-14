import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { CodingSubmissionDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
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
}
