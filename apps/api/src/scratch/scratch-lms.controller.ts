import { BadRequestException, Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { SCRATCH_MD5EXT_PATTERN } from '@lms/contracts';
import type { OpenScratchActivityRequest, OpenScratchActivityResponse } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { ScratchLmsService } from './scratch-lms.service';
import { setPrivateAssetHeaders } from './asset-headers';

export class OpenScratchActivityDto implements OpenScratchActivityRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  classId!: string;
}

/** BlockSpace trong bài học / bài nộp (T11.7). Quyền theo lớp kiểm ở service. */
@Controller('scratch')
@UseGuards(JwtAuthGuard)
export class ScratchLmsController {
  constructor(private readonly lms: ScratchLmsService) {}

  @Post('activities/:id/open')
  open(
    @Param('id') id: string,
    @Body() dto: OpenScratchActivityDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<OpenScratchActivityResponse> {
    return this.lms.openActivity(id, dto.classId, user.userId);
  }

  @Get('submissions/:id/project.json')
  submissionJson(@Param('id') id: string, @CurrentUser() user: AuthPrincipal): Promise<unknown> {
    return this.lms.submissionJson(id, user.userId);
  }

  @Get('submissions/:id/assets/:md5ext')
  async submissionAsset(
    @Param('id') id: string,
    @Param('md5ext') md5ext: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    if (!SCRATCH_MD5EXT_PATTERN.test(md5ext)) throw new BadRequestException('Tên asset không hợp lệ');
    const { buffer, mime } = await this.lms.submissionAsset(id, md5ext, user.userId);
    setPrivateAssetHeaders(res, mime);
    res.send(buffer);
  }
}
