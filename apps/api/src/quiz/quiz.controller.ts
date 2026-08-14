import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { Paginated, QuizAuthorDetail, QuizSummary } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { UpsertQuestionDto } from './dto/upsert-question.dto';
import { ListQuizzesQueryDto } from './dto/list-quizzes-query.dto';

@Controller('quizzes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get()
  @RequirePermission(PERMISSIONS.QUIZ_READ)
  list(@Query() q: ListQuizzesQueryDto): Promise<Paginated<QuizSummary>> {
    return this.quiz.list(q.courseId, q.page, q.pageSize);
  }

  @Post()
  @RequirePermission(PERMISSIONS.QUIZ_CREATE)
  create(@Body() dto: CreateQuizDto, @CurrentUser() user: AuthPrincipal): Promise<QuizAuthorDetail> {
    return this.quiz.create(dto, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.QUIZ_READ)
  findOne(@Param('id') id: string): Promise<QuizAuthorDetail> {
    return this.quiz.getAuthorDetail(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.QUIZ_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateQuizDto): Promise<QuizAuthorDetail> {
    return this.quiz.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.QUIZ_DELETE)
  remove(@Param('id') id: string): Promise<void> {
    return this.quiz.remove(id);
  }

  @Put(':id/questions')
  @RequirePermission(PERMISSIONS.QUIZ_UPDATE)
  upsertQuestion(@Param('id') id: string, @Body() dto: UpsertQuestionDto): Promise<QuizAuthorDetail> {
    return this.quiz.upsertQuestion(id, dto);
  }

  @Delete(':id/questions/:questionId')
  @RequirePermission(PERMISSIONS.QUIZ_UPDATE)
  removeQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ): Promise<QuizAuthorDetail> {
    return this.quiz.removeQuestion(id, questionId);
  }
}
