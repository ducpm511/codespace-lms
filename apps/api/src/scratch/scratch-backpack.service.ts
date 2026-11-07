import { createHash, randomUUID } from 'crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  SCRATCH_BACKPACK_ITEM_MAX_BYTES,
  SCRATCH_BACKPACK_MAX_ITEMS,
  SCRATCH_BACKPACK_QUOTA_BYTES,
  SCRATCH_BACKPACK_THUMBNAIL_MAX_BYTES,
} from '@lms/contracts';
import type { ScratchBackpackItemDto, ScratchBackpackItemTypeValue } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { matchesFormat } from './asset-content';

/** Đuôi theo loại mục: costume/sound do magic bytes quyết, không tin mime client gửi. */
const COSTUME_FORMATS: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png' };
const SOUND_FORMATS: Record<string, string> = { wav: 'audio/x-wav', mp3: 'audio/mp3' };

interface CheckedBody {
  mime: string;
  md5ext: string | null;
}

const SELECT = {
  id: true,
  type: true,
  name: true,
  mime: true,
  md5ext: true,
  sizeBytes: true,
  thumbnail: true,
  createdAt: true,
} as const;

/**
 * Ba lô của trình soạn BlockSpace — kho riêng của MỘT người (IDOR: mọi truy vấn lọc theo `userId` của
 * phiên đăng nhập; không có route đọc ba lô người khác, mục của người khác ⇒ 404 như không tồn tại).
 * Nội dung là bản sao riêng ở storage private, không phụ thuộc dự án gốc / `scratch_assets`.
 * Không ghi audit: kho cá nhân như clipboard, không phải dữ liệu nghiệp vụ (giống tải asset).
 */
@Injectable()
export class ScratchBackpackService {
  private readonly logger = new Logger(ScratchBackpackService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async list(userId: string, offset: number, limit: number): Promise<ScratchBackpackItemDto[]> {
    const rows = await this.prisma.scratchBackpackItem.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
      select: SELECT,
    });
    return rows.map(toDto);
  }

  async add(
    userId: string,
    input: { type: ScratchBackpackItemTypeValue; name: string },
    body: Buffer | undefined,
    thumbnail: Buffer | undefined,
  ): Promise<ScratchBackpackItemDto> {
    if (!body || body.length === 0) throw new BadRequestException('Thiếu nội dung');
    if (body.length > SCRATCH_BACKPACK_ITEM_MAX_BYTES) {
      throw new BadRequestException(`Mục vượt quá ${SCRATCH_BACKPACK_ITEM_MAX_BYTES / (1024 * 1024)}MB`);
    }
    if (!thumbnail || thumbnail.length === 0 || thumbnail.length > SCRATCH_BACKPACK_THUMBNAIL_MAX_BYTES) {
      throw new BadRequestException('Ảnh thu nhỏ không hợp lệ');
    }
    if (!matchesFormat('jpg', thumbnail)) throw new BadRequestException('Ảnh thu nhỏ phải là JPEG');
    const checked = checkBody(input.type, body);
    const name = input.name.trim();

    // Khóa do server dựng từ id server sinh — không có đường dẫn từ client.
    const id = randomUUID();
    const storageKey = `scratch-backpack/${id}`;
    await this.storage.put(storageKey, body, checked.mime);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // Hai lần thêm song song của cùng một người không được cùng lọt qua hạn mức.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`scratch-backpack:${userId}`}))`;
        const used = await tx.scratchBackpackItem.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: { sizeBytes: true },
        });
        if (used._count._all >= SCRATCH_BACKPACK_MAX_ITEMS) {
          throw new BadRequestException(`Ba lô đã đầy (${SCRATCH_BACKPACK_MAX_ITEMS} mục) — xóa bớt mục cũ nhé`);
        }
        if ((used._sum.sizeBytes ?? 0) + body.length > SCRATCH_BACKPACK_QUOTA_BYTES) {
          throw new BadRequestException(
            `Ba lô đã dùng hết ${SCRATCH_BACKPACK_QUOTA_BYTES / (1024 * 1024)}MB — xóa bớt mục cũ nhé`,
          );
        }
        return tx.scratchBackpackItem.create({
          data: {
            id,
            userId,
            type: input.type,
            name,
            mime: checked.mime,
            md5ext: checked.md5ext,
            sizeBytes: body.length,
            provider: this.storage.provider,
            storageKey,
            thumbnail,
          },
          select: SELECT,
        });
      });
      return toDto(row);
    } catch (e) {
      await this.removeFile(storageKey);
      throw e;
    }
  }

  async body(userId: string, id: string): Promise<{ buffer: Buffer; mime: string }> {
    const row = await this.prisma.scratchBackpackItem.findFirst({
      where: { id, userId },
      select: { storageKey: true, mime: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy mục trong ba lô');
    return { buffer: await this.storage.get(row.storageKey), mime: row.mime };
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.scratchBackpackItem.findFirst({
      where: { id, userId },
      select: { storageKey: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy mục trong ba lô');
    // deleteMany lọc cả userId: bấm xóa hai lần cùng lúc không lỗi, và không thể xóa nhầm mục người khác.
    await this.prisma.scratchBackpackItem.deleteMany({ where: { id, userId } });
    await this.removeFile(row.storageKey);
  }

  private async removeFile(storageKey: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
    } catch (e) {
      // File mồ côi không hại gì (không còn dòng thì không ai đọc được); không làm hỏng thao tác của học viên.
      this.logger.warn(`Không xóa được file ba lô ${storageKey}: ${(e as Error).message}`);
    }
  }
}

/** Kiểm nội dung theo loại (INVARIANT #4): mime / đuôi suy từ nội dung, không từ client. */
export function checkBody(type: ScratchBackpackItemTypeValue, body: Buffer): CheckedBody {
  switch (type) {
    case 'costume':
    case 'sound': {
      const formats = type === 'costume' ? COSTUME_FORMATS : SOUND_FORMATS;
      const ext = Object.keys(formats).find((f) => matchesFormat(f, body));
      if (!ext) throw new BadRequestException('Nội dung không đúng định dạng');
      return { mime: formats[ext], md5ext: `${createHash('md5').update(body).digest('hex')}.${ext}` };
    }
    case 'sprite':
      // .sprite3 là zip ("PK\x03\x04").
      if (!(body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04)) {
        throw new BadRequestException('Nhân vật không đúng định dạng');
      }
      return { mime: 'application/zip', md5ext: null };
    case 'script': {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        throw new BadRequestException('Khối lệnh không đúng định dạng');
      }
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((b) => b && typeof b === 'object')) {
        throw new BadRequestException('Khối lệnh không đúng định dạng');
      }
      return { mime: 'application/json', md5ext: null };
    }
    default:
      throw new BadRequestException('Loại mục không hợp lệ');
  }
}

function toDto(row: {
  id: string;
  type: ScratchBackpackItemTypeValue;
  name: string;
  mime: string;
  md5ext: string | null;
  sizeBytes: number;
  thumbnail: Uint8Array;
  createdAt: Date;
}): ScratchBackpackItemDto {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    mime: row.mime,
    md5ext: row.md5ext,
    sizeBytes: row.sizeBytes,
    thumbnail: Buffer.from(row.thumbnail).toString('base64'),
    createdAt: row.createdAt.toISOString(),
  };
}
