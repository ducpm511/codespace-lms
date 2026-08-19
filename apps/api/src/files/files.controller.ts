import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MAX_UPLOAD_BYTES, PERMISSIONS } from '@lms/contracts';
import type { FileUploadResponse } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { contentDisposition } from '../common/http/content-disposition';
import { FilesService, type UploadedFileLike } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /**
   * Upload tài liệu bài học (P7: PDF slide). Chặn ở 2 lớp: multer `limits.fileSize` (không nạp file quá cỡ
   * vào RAM) + kiểm mime/magic-bytes trong service. Chỉ người soạn khóa (`course.update`) được upload.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<FileUploadResponse> {
    return this.files.upload(file, user.userId);
  }

  /** Tải file private — quyền kiểm trong service (owner / soạn khóa / thành viên lớp đã mở gate). */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName, mime } = await this.files.download(id, user.userId);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', contentDisposition('inline', fileName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }
}
