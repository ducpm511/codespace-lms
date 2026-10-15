import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { ScratchBannedWordDto, ScratchCommentDto, ScratchCommentsDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequest, AuthPrincipal } from '../auth/auth.types';
import { ScratchCommentsService } from './scratch-comments.service';
import { ScratchCommentModerationService } from './scratch-comment-moderation.service';
import { CreateReportDto } from './dto/publishing.dto';
import { AddBannedWordDto, CreateCommentDto, ResolveCommentReportDto, SetCommentsOpenDto } from './dto/comments.dto';

const actorOf = (user: AuthPrincipal, req: AuthenticatedRequest) => ({ userId: user.userId, ip: req.ip });

/** Bình luận BlockSpace (T11.8). Quyền kiểm ở service (xem được dự án / chủ dự án / GV). */
@Controller('scratch')
@UseGuards(JwtAuthGuard)
export class ScratchCommentsController {
  constructor(private readonly comments: ScratchCommentsService) {}

  @Get('projects/:id/comments')
  list(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<ScratchCommentsDto> {
    return this.comments.list(id, user.userId);
  }

  @Post('projects/:id/comments')
  create(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ScratchCommentDto> {
    return this.comments.create(id, dto.content, user.userId);
  }

  @Put('projects/:id/comments/open')
  @HttpCode(204)
  setOpen(
    @Param('id') id: string,
    @Body() dto: SetCommentsOpenDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.comments.setOpen(id, dto.open, actorOf(user, req));
  }

  @Delete('comments/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal, @Req() req: AuthenticatedRequest): Promise<void> {
    return this.comments.remove(id, actorOf(user, req));
  }

  @Post('comments/:id/hide')
  @HttpCode(204)
  hide(@Param('id') id: string, @CurrentUser() user: AuthPrincipal, @Req() req: AuthenticatedRequest): Promise<void> {
    return this.comments.setHidden(id, true, actorOf(user, req));
  }

  @Post('comments/:id/unhide')
  @HttpCode(204)
  unhide(@Param('id') id: string, @CurrentUser() user: AuthPrincipal, @Req() req: AuthenticatedRequest): Promise<void> {
    return this.comments.setHidden(id, false, actorOf(user, req));
  }

  @Post('comments/:id/report')
  @HttpCode(204)
  report(@Param('id') id: string, @Body() dto: CreateReportDto, @CurrentUser() user: AuthPrincipal): Promise<void> {
    return this.comments.report(id, dto, user.userId);
  }
}

/** Kiểm duyệt bình luận + từ cấm (T11.8). */
@Controller('scratch/moderation')
@UseGuards(JwtAuthGuard)
export class ScratchCommentModerationController {
  constructor(private readonly moderation: ScratchCommentModerationService) {}

  @Post('comment-reports/:id/resolve')
  @HttpCode(204)
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveCommentReportDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.moderation.resolveReport(id, dto.action, actorOf(user, req));
  }

  @Get('banned-words')
  bannedWords(@CurrentUser() user: AuthPrincipal): Promise<ScratchBannedWordDto[]> {
    return this.moderation.listBannedWords(user.userId);
  }

  @Post('banned-words')
  addBannedWord(
    @Body() dto: AddBannedWordDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchBannedWordDto[]> {
    return this.moderation.addBannedWord(dto.word, actorOf(user, req));
  }

  @Delete('banned-words/:word')
  removeBannedWord(
    @Param('word') word: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchBannedWordDto[]> {
    return this.moderation.removeBannedWord(word, actorOf(user, req));
  }
}
