import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { SCRATCH_USER_QUOTA_BYTES } from '@lms/contracts';
import type { ScratchAssetUploadResponse } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { checkAsset } from './asset-content';

/**
 * Tải asset (ảnh/âm thanh) lên storage PRIVATE (ADR D7 — có thể là giọng nói / khuôn mặt học viên).
 * Lưu theo nội dung: cùng md5 ⇒ một file, lần sau trả `created: false` (idempotent khi trình soạn gửi
 * lại). Asset chỉ ĐỌC được qua dự án tham chiếu nó (`ScratchProjectsService.asset`).
 */
@Injectable()
export class ScratchAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async upload(md5ext: string, buffer: Buffer | undefined, userId: string): Promise<ScratchAssetUploadResponse> {
    const asset = checkAsset(md5ext, buffer);
    const bytes = buffer!.length;

    const existing = await this.prisma.scratchAsset.findUnique({ where: { md5ext }, select: { sizeBytes: true } });
    if (existing) return { md5ext, sizeBytes: existing.sizeBytes, created: false };

    const used = await this.prisma.scratchAsset.aggregate({
      where: { uploadedById: userId },
      _sum: { sizeBytes: true },
    });
    if ((used._sum.sizeBytes ?? 0) + bytes > SCRATCH_USER_QUOTA_BYTES) {
      throw new BadRequestException(`Đã dùng hết ${SCRATCH_USER_QUOTA_BYTES / (1024 * 1024)}MB dành cho ảnh/âm thanh`);
    }

    // Khóa do server dựng từ md5ext ĐÃ kiểm allowlist — không có đường dẫn từ client.
    const storageKey = `scratch-assets/${md5ext}`;
    await this.storage.put(storageKey, buffer!, asset.mime);
    try {
      await this.prisma.scratchAsset.create({
        data: {
          md5ext,
          dataFormat: asset.dataFormat,
          mime: asset.mime,
          sizeBytes: bytes,
          provider: this.storage.provider,
          storageKey,
          uploadedById: userId,
        },
      });
    } catch (e) {
      // Hai người tải cùng nội dung cùng lúc: bản kia thắng, cùng một file — coi như đã có.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { md5ext, sizeBytes: bytes, created: false };
      }
      throw e;
    }
    return { md5ext, sizeBytes: bytes, created: true };
  }
}
