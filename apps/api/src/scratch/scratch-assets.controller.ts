import { Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SCRATCH_ASSET_MAX_BYTES } from '@lms/contracts';
import type { ScratchAssetUploadResponse } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import type { UploadedFileLike } from '../files/files.service';
import { ScratchAssetsService } from './scratch-assets.service';

@Controller('scratch/assets')
@UseGuards(JwtAuthGuard)
export class ScratchAssetsController {
  constructor(private readonly assets: ScratchAssetsService) {}

  /** Tải asset (multipart, trường `file`) — tên là md5ext của nội dung; kiểm md5 + magic bytes + hạn mức. */
  @Post(':md5ext')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SCRATCH_ASSET_MAX_BYTES, files: 1 } }))
  upload(
    @Param('md5ext') md5ext: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ScratchAssetUploadResponse> {
    return this.assets.upload(md5ext, file?.buffer, user.userId);
  }
}
