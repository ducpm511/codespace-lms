import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('lessons/:lessonId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list(
    @Param('lessonId') lessonId: string,
    @Query('classId') classId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.commentsService.listForLesson(lessonId, classId, user.userId);
  }

  @Post()
  create(
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.commentsService.create(lessonId, dto, user.userId);
  }
}
