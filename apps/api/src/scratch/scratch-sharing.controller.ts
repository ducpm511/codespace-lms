import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type {
  ScratchClassDto,
  ScratchLikeResponse,
  ScratchProjectDetailDto,
  ScratchProjectSummaryDto,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { ScratchSharingService } from './scratch-sharing.service';
import { GalleryQueryDto } from './dto/gallery-query.dto';
import { RemixScratchProjectDto } from './dto/remix-scratch-project.dto';

/** Chia sẻ BlockSpace: lớp của tôi, gallery, remix, thích. */
@Controller('scratch')
@UseGuards(JwtAuthGuard)
export class ScratchSharingController {
  constructor(private readonly sharing: ScratchSharingService) {}

  @Get('classes')
  myClasses(@CurrentUser() user: AuthPrincipal): Promise<ScratchClassDto[]> {
    return this.sharing.myClasses(user.userId);
  }

  @Get('gallery')
  gallery(@Query() q: GalleryQueryDto, @CurrentUser() user: AuthPrincipal): Promise<ScratchProjectSummaryDto[]> {
    return this.sharing.gallery(q.scope, q.classId, user.userId);
  }

  @Post('projects/:id/remix')
  remix(
    @Param('id') id: string,
    @Body() dto: RemixScratchProjectDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ScratchProjectDetailDto> {
    return this.sharing.remix(id, dto.title, user.userId);
  }

  @Put('projects/:id/like')
  like(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<ScratchLikeResponse> {
    return this.sharing.setLike(id, true, user.userId);
  }

  @Delete('projects/:id/like')
  unlike(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<ScratchLikeResponse> {
    return this.sharing.setLike(id, false, user.userId);
  }
}
