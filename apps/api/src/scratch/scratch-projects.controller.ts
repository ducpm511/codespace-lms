import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SCRATCH_MD5EXT_PATTERN, SCRATCH_PROJECT_JSON_MAX_BYTES } from '@lms/contracts';
import type { ScratchProjectDetailDto, ScratchProjectSummaryDto, ScratchProjectVersionDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequest, AuthPrincipal } from '../auth/auth.types';
import type { UploadedFileLike } from '../files/files.service';
import { ScratchProjectsService } from './scratch-projects.service';
import { CreateScratchProjectDto } from './dto/create-scratch-project.dto';
import { UpdateScratchProjectDto } from './dto/update-scratch-project.dto';
import { setPrivateAssetHeaders } from './asset-headers';

/** Dự án BlockSpace. Quyền trên từng dự án kiểm ở ScratchAccessService (qua service). */
@Controller('scratch/projects')
@UseGuards(JwtAuthGuard)
export class ScratchProjectsController {
  constructor(private readonly projects: ScratchProjectsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthPrincipal): Promise<ScratchProjectSummaryDto[]> {
    return this.projects.listMine(user.userId);
  }

  @Post()
  create(@Body() dto: CreateScratchProjectDto, @CurrentUser() user: AuthPrincipal): Promise<ScratchProjectDetailDto> {
    return this.projects.create(dto, user.userId);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<ScratchProjectDetailDto> {
    return this.projects.detail(id, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScratchProjectDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchProjectDetailDto> {
    return this.projects.update(id, dto, { userId: user.userId, ip: req.ip });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal, @Req() req: AuthenticatedRequest): Promise<void> {
    return this.projects.remove(id, { userId: user.userId, ip: req.ip });
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<ScratchProjectVersionDto[]> {
    return this.projects.listVersions(id, user.userId);
  }

  /**
   * Lưu phiên bản: project.json gửi dạng multipart (trường `project`) — multer giới hạn đúng 5 MB mà không
   * phải nới giới hạn body JSON (100 KB) của toàn API.
   */
  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('project', { limits: { fileSize: SCRATCH_PROJECT_JSON_MAX_BYTES, files: 1 } }))
  saveVersion(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ScratchProjectVersionDto> {
    return this.projects.saveVersion(id, file?.buffer, user.userId);
  }

  /** project.json — `latest` hoặc số phiên bản. */
  @Get(':id/versions/:seq')
  versionJson(
    @Param('id') id: string,
    @Param('seq') seq: string,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<unknown> {
    return this.projects.versionJson(id, parseSeq(seq), user.userId);
  }

  @Get(':id/assets/:md5ext')
  async asset(
    @Param('id') id: string,
    @Param('md5ext') md5ext: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    if (!SCRATCH_MD5EXT_PATTERN.test(md5ext)) throw new BadRequestException('Tên asset không hợp lệ');
    const { buffer, mime } = await this.projects.asset(id, md5ext, user.userId);
    setPrivateAssetHeaders(res, mime);
    res.send(buffer);
  }
}

function parseSeq(seq: string): number | 'latest' {
  if (seq === 'latest') return 'latest';
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) throw new BadRequestException('Số phiên bản không hợp lệ');
  return n;
}
