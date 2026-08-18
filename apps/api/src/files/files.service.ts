import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ALLOWED_UPLOAD_MIMES, MAX_UPLOAD_BYTES, PERMISSIONS } from '@lms/contracts';
import type { FileUploadResponse } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';

/** Multer file (khai báo tại chỗ để không phụ thuộc @types/multer). */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileDownload {
  buffer: Buffer;
  fileName: string;
  mime: string;
}

/** Magic bytes của PDF — chặn file đổi đuôi/giả mime từ client. */
const PDF_MAGIC = '%PDF-';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  /**
   * Upload file private (P7: chỉ PDF slide). `storageKey` do server sinh — KHÔNG dùng tên client gửi lên
   * để dựng đường dẫn (chống path-traversal); tên gốc chỉ lưu để hiển thị.
   */
  async upload(file: UploadedFileLike | undefined, ownerId: string): Promise<FileUploadResponse> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Thiếu file tải lên');
    }
    if (!ALLOWED_UPLOAD_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận file PDF');
    }
    const sizeBytes = file.size ?? file.buffer.length;
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File vượt quá ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`);
    }
    if (file.buffer.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
      throw new BadRequestException('Nội dung file không phải PDF hợp lệ');
    }

    const storageKey = `lesson-files/${randomUUID()}.pdf`;
    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const row = await this.prisma.file.create({
      data: {
        ownerId,
        provider: 'local',
        storageKey,
        fileName: sanitizeFileName(file.originalname),
        mime: file.mimetype,
        sizeBytes,
        visibility: 'private',
      },
    });

    return {
      id: row.id,
      fileName: row.fileName,
      mime: row.mime,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Tải file private — chỉ chủ sở hữu / người soạn khóa / thành viên lớp được phép (xem `ensureCanRead`). */
  async download(fileId: string, userId: string): Promise<FileDownload> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File không tồn tại');
    }
    await this.ensureCanRead(file.id, file.ownerId, userId);
    const buffer = await this.storage.get(file.storageKey);
    return { buffer, fileName: file.fileName ?? 'document.pdf', mime: file.mime };
  }

  /**
   * Guard đọc file (chống rò rỉ chéo lớp):
   * 1. chủ sở hữu;
   * 2. người có `course.update` global (surface soạn bài);
   * 3. thành viên active của lớp có LessonGate ĐANG MỞ trên bài dùng file (INVARIANT #3);
   * 4. instructor/TA active của lớp đã được gán khóa chứa bài đó (xem trước khi mở gate).
   */
  private async ensureCanRead(fileId: string, ownerId: string | null, userId: string): Promise<void> {
    if (ownerId && ownerId === userId) {
      return;
    }

    const eff = await this.rbac.getEffectivePermissions(userId);
    if (this.rbac.hasPermission(eff, PERMISSIONS.COURSE_UPDATE)) {
      return;
    }

    const activities = await this.prisma.lessonActivity.findMany({
      where: { fileId },
      select: { lessonId: true },
    });
    const lessonIds = [...new Set(activities.map((a) => a.lessonId))];
    if (lessonIds.length === 0) {
      throw new ForbiddenException('Bạn không có quyền truy cập file này');
    }

    const membership = await this.prisma.classMember.findFirst({
      where: {
        userId,
        status: 'active',
        OR: [
          { class: { gates: { some: { lessonId: { in: lessonIds }, isActive: true } } } },
          {
            roleInClass: { in: ['instructor', 'ta'] },
            class: {
              courses: {
                some: {
                  course: { sections: { some: { lessons: { some: { id: { in: lessonIds } } } } } },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Bạn không có quyền truy cập file này');
    }
  }
}

/** Giữ tên cơ sở an toàn để hiển thị/Content-Disposition: bỏ đường dẫn, ký tự điều khiển, nháy, backslash. */
export function sanitizeFileName(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = Array.from(base)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code > 31 && code !== 127 && ch !== '"' && ch !== "'" && ch !== '\\';
    })
    .join('')
    .trim();
  return (cleaned || 'document.pdf').slice(0, 200);
}
