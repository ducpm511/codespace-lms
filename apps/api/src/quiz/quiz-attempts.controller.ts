import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { QuizAttemptDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { QuizService } from './quiz.service';

/**
 * Đọc kết quả một lượt làm quiz. KHÔNG @RequirePermission: route không có :classId nên scope kiểm
 * trong service theo attempt.classId (chủ sở hữu, hoặc GV/TA có quiz.result.read của lớp đó).
 */
@Controller('quiz-attempts')
@UseGuards(JwtAuthGuard)
export class QuizAttemptsController {
  constructor(private readonly quiz: QuizService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<QuizAttemptDto> {
    return this.quiz.getAttempt(id, user);
  }
}
