import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SCRATCH_BACKPACK_ITEM_MAX_BYTES } from '@lms/contracts';
import type { ScratchBackpackItemDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import type { UploadedFileLike } from '../files/files.service';
import { ScratchBackpackService } from './scratch-backpack.service';
import { CreateScratchBackpackItemDto, ListScratchBackpackQueryDto } from './dto/backpack.dto';
import { setPrivateAssetHeaders } from './asset-headers';

/**
 * Ba lô của chính người đăng nhập — KHÔNG có tham số userId ở đâu cả (INVARIANT #3): mọi route chỉ chạm
 * mục của `CurrentUser`; id mục của người khác ⇒ 404.
 */
@Controller('scratch/backpack')
@UseGuards(JwtAuthGuard)
export class ScratchBackpackController {
  constructor(private readonly backpack: ScratchBackpackService) {}

  @Get()
  list(@Query() q: ListScratchBackpackQueryDto, @CurrentUser() user: AuthPrincipal): Promise<ScratchBackpackItemDto[]> {
    return this.backpack.list(user.userId, q.offset, q.limit);
  }

  /** Multipart: `type`, `name` + file `body`, `thumbnail`. */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'body', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      { limits: { fileSize: SCRATCH_BACKPACK_ITEM_MAX_BYTES, files: 2, fields: 4 } },
    ),
  )
  add(
    @Body() dto: CreateScratchBackpackItemDto,
    @UploadedFiles() files: { body?: UploadedFileLike[]; thumbnail?: UploadedFileLike[] } | undefined,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ScratchBackpackItemDto> {
    return this.backpack.add(user.userId, dto, files?.body?.[0]?.buffer, files?.thumbnail?.[0]?.buffer);
  }

  @Get(':id/body')
  async body(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, mime } = await this.backpack.body(user.userId, id);
    setPrivateAssetHeaders(res, mime);
    res.send(buffer);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthPrincipal): Promise<void> {
    return this.backpack.remove(user.userId, id);
  }
}
