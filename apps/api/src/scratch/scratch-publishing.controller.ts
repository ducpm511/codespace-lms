import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SCRATCH_MD5EXT_PATTERN } from '@lms/contracts';
import type {
  ScratchModerationQueueDto,
  ScratchNicknameDto,
  ScratchProjectDetailDto,
  ScratchPublicationDto,
  ScratchPublicProjectDto,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequest, AuthPrincipal } from '../auth/auth.types';
import { ScratchPublishingService } from './scratch-publishing.service';
import { ScratchModerationService } from './scratch-moderation.service';
import { ScratchSharingService } from './scratch-sharing.service';
import { setPrivateAssetHeaders } from './asset-headers';
import {
  CreateReportDto,
  ModerationNoteDto,
  RequestPublicationDto,
  ResolveReportDto,
  SetNicknameDto,
} from './dto/publishing.dto';

/** Dự án của trẻ em: "ai có link" chứ không để công cụ tìm kiếm lập chỉ mục. */
const NOINDEX = 'noindex, nofollow';

const actorOf = (user: AuthPrincipal, req: AuthenticatedRequest) => ({ userId: user.userId, ip: req.ip });

function assertMd5ext(md5ext: string): void {
  if (!SCRATCH_MD5EXT_PATTERN.test(md5ext)) throw new BadRequestException('Tên asset không hợp lệ');
}

/** Phía chủ dự án: biệt danh, xin / gỡ công khai, báo cáo dự án trong LMS. */
@Controller('scratch')
@UseGuards(JwtAuthGuard)
export class ScratchPublishingController {
  constructor(private readonly publishing: ScratchPublishingService) {}

  @Get('me/nickname')
  nickname(@CurrentUser() user: AuthPrincipal): Promise<ScratchNicknameDto> {
    return this.publishing.getNickname(user.userId);
  }

  @Put('me/nickname')
  setNickname(@Body() dto: SetNicknameDto, @CurrentUser() user: AuthPrincipal): Promise<ScratchNicknameDto> {
    return this.publishing.setNickname(user.userId, dto.nickname);
  }

  @Post('projects/:id/publication')
  request(
    @Param('id') id: string,
    @Body() dto: RequestPublicationDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchPublicationDto> {
    return this.publishing.request(id, dto.nickname, actorOf(user, req));
  }

  @Delete('projects/:id/publication')
  withdraw(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchPublicationDto | null> {
    return this.publishing.withdraw(id, actorOf(user, req));
  }

  @Post('projects/:id/report')
  @HttpCode(204)
  report(@Param('id') id: string, @Body() dto: CreateReportDto, @CurrentUser() user: AuthPrincipal): Promise<void> {
    return this.publishing.report(id, dto, user.userId);
  }
}

/**
 * Trang công khai `/p/<slug>` — GET KHÔNG cần đăng nhập (ADR D4′: ai có link cũng xem được). Chỉ phục vụ
 * bản đã duyệt. Remix / báo cáo thì phải đăng nhập. Rate limit chung theo IP vẫn áp dụng.
 */
@Controller('scratch/public')
export class ScratchPublicController {
  constructor(
    private readonly publishing: ScratchPublishingService,
    private readonly sharing: ScratchSharingService,
  ) {}

  @Get(':slug')
  @Header('X-Robots-Tag', NOINDEX)
  project(@Param('slug') slug: string): Promise<ScratchPublicProjectDto> {
    return this.publishing.publicProject(slug);
  }

  @Get(':slug/project.json')
  @Header('X-Robots-Tag', NOINDEX)
  projectJson(@Param('slug') slug: string): Promise<unknown> {
    return this.publishing.publicProjectJson(slug);
  }

  @Get(':slug/assets/:md5ext')
  async asset(@Param('slug') slug: string, @Param('md5ext') md5ext: string, @Res() res: Response): Promise<void> {
    assertMd5ext(md5ext);
    const { buffer, mime } = await this.publishing.publicAsset(slug, md5ext);
    setPrivateAssetHeaders(res, mime);
    res.setHeader('X-Robots-Tag', NOINDEX);
    res.send(buffer);
  }

  @Post(':slug/remix')
  @UseGuards(JwtAuthGuard)
  remix(@Param('slug') slug: string, @CurrentUser() user: AuthPrincipal): Promise<ScratchProjectDetailDto> {
    return this.sharing.remixPublished(slug, user.userId);
  }

  @Post(':slug/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  report(@Param('slug') slug: string, @Body() dto: CreateReportDto, @CurrentUser() user: AuthPrincipal): Promise<void> {
    return this.publishing.reportPublic(slug, dto, user.userId);
  }
}

/** Kiểm duyệt — quyền với TỪNG học viên kiểm trong service (GV lớp em học hoặc `scratch.moderate`). */
@Controller('scratch/moderation')
@UseGuards(JwtAuthGuard)
export class ScratchModerationController {
  constructor(private readonly moderation: ScratchModerationService) {}

  @Get('queue')
  queue(@CurrentUser() user: AuthPrincipal): Promise<ScratchModerationQueueDto> {
    return this.moderation.queue(user.userId);
  }

  @Get('publications/:projectId/project.json')
  requestedJson(@Param('projectId') projectId: string, @CurrentUser() user: AuthPrincipal): Promise<unknown> {
    return this.moderation.requestedJson(projectId, user.userId);
  }

  @Get('publications/:projectId/assets/:md5ext')
  async requestedAsset(
    @Param('projectId') projectId: string,
    @Param('md5ext') md5ext: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    assertMd5ext(md5ext);
    const { buffer, mime } = await this.moderation.requestedAsset(projectId, md5ext, user.userId);
    setPrivateAssetHeaders(res, mime);
    res.send(buffer);
  }

  @Post('publications/:projectId/approve')
  @HttpCode(204)
  approve(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.moderation.approve(projectId, actorOf(user, req));
  }

  @Post('publications/:projectId/reject')
  @HttpCode(204)
  reject(
    @Param('projectId') projectId: string,
    @Body() dto: ModerationNoteDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.moderation.reject(projectId, dto.note, actorOf(user, req));
  }

  @Post('publications/:projectId/remove')
  @HttpCode(204)
  remove(
    @Param('projectId') projectId: string,
    @Body() dto: ModerationNoteDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.moderation.remove(projectId, dto.note, actorOf(user, req));
  }

  @Post('nicknames/:userId/:decision')
  @HttpCode(204)
  nickname(
    @Param('userId') userId: string,
    @Param('decision') decision: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    if (decision !== 'approve' && decision !== 'reject') throw new BadRequestException('Quyết định không hợp lệ');
    return this.moderation.decideNickname(userId, decision === 'approve', actorOf(user, req));
  }

  @Post('reports/:id/resolve')
  @HttpCode(204)
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.moderation.resolveReport(id, dto.action, actorOf(user, req));
  }
}
