import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MAX_UPLOAD_BYTES } from '@lms/contracts';
import {
  FilesService,
  decodeMultipartFileName,
  sanitizeFileName,
  type UploadedFileLike,
} from './files.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import type { StorageAdapter } from '../common/storage/storage.interface';

function pdfBuffer(body = 'hello'): Buffer {
  return Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), Buffer.from(body)]);
}

function makeFile(overrides: Partial<UploadedFileLike> = {}): UploadedFileLike {
  const buffer = overrides.buffer ?? pdfBuffer();
  return {
    originalname: 'slide.pdf',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

describe('FilesService', () => {
  let prisma: {
    file: { create: jest.Mock; findUnique: jest.Mock };
    lessonActivity: { findMany: jest.Mock };
    classMember: { findFirst: jest.Mock };
  };
  let rbac: { getEffectivePermissions: jest.Mock; hasPermission: jest.Mock };
  let storage: { put: jest.Mock; get: jest.Mock; delete: jest.Mock };
  let service: FilesService;

  beforeEach(() => {
    prisma = {
      file: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'file1', createdAt: new Date('2026-08-18T00:00:00Z'), ...data }),
        ),
        findUnique: jest.fn(),
      },
      lessonActivity: { findMany: jest.fn().mockResolvedValue([]) },
      classMember: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    rbac = {
      getEffectivePermissions: jest.fn().mockResolvedValue({ global: new Set<string>(), byClass: new Map() }),
      hasPermission: jest.fn().mockReturnValue(false),
    };
    storage = { put: jest.fn().mockResolvedValue('key'), get: jest.fn().mockResolvedValue(pdfBuffer()), delete: jest.fn() };
    service = new FilesService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
      storage as unknown as StorageAdapter,
    );
  });

  describe('upload', () => {
    it('lưu file PDF hợp lệ với storageKey do server sinh (không dùng tên client)', async () => {
      const res = await service.upload(makeFile({ originalname: '../../etc/passwd.pdf' }), 'owner1');

      expect(storage.put).toHaveBeenCalledTimes(1);
      const key = storage.put.mock.calls[0][0] as string;
      expect(key).toMatch(/^lesson-files\/[0-9a-f-]{36}\.pdf$/);
      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: 'owner1', visibility: 'private', fileName: 'passwd.pdf' }),
        }),
      );
      expect(res.id).toBe('file1');
    });

    it('từ chối mime ngoài allowlist', async () => {
      await expect(service.upload(makeFile({ mimetype: 'image/png' }), 'owner1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('từ chối file vượt giới hạn dung lượng', async () => {
      await expect(
        service.upload(makeFile({ size: MAX_UPLOAD_BYTES + 1 }), 'owner1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('từ chối file giả mime PDF (sai magic bytes)', async () => {
      await expect(
        service.upload(makeFile({ buffer: Buffer.from('<script>alert(1)</script>') }), 'owner1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.put).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    const file = { id: 'file1', ownerId: 'owner1', storageKey: 'k', fileName: 'slide.pdf', mime: 'application/pdf' };

    it('404 khi file không tồn tại', async () => {
      prisma.file.findUnique.mockResolvedValue(null);
      await expect(service.download('nope', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cho phép chủ sở hữu', async () => {
      prisma.file.findUnique.mockResolvedValue(file);
      const res = await service.download('file1', 'owner1');
      expect(res.fileName).toBe('slide.pdf');
      expect(prisma.classMember.findFirst).not.toHaveBeenCalled();
    });

    it('cho phép người có quyền course.update (surface soạn bài)', async () => {
      prisma.file.findUnique.mockResolvedValue(file);
      rbac.hasPermission.mockReturnValue(true);
      await expect(service.download('file1', 'other')).resolves.toMatchObject({ mime: 'application/pdf' });
    });

    it('403 khi file chưa gắn vào activity nào (không rò rỉ file lạ)', async () => {
      prisma.file.findUnique.mockResolvedValue(file);
      prisma.lessonActivity.findMany.mockResolvedValue([]);
      await expect(service.download('file1', 'other')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 khi user không phải thành viên lớp nào dùng file (chống rò rỉ chéo lớp)', async () => {
      prisma.file.findUnique.mockResolvedValue(file);
      prisma.lessonActivity.findMany.mockResolvedValue([{ lessonId: 'l1' }]);
      prisma.classMember.findFirst.mockResolvedValue(null);
      await expect(service.download('file1', 'other')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cho phép thành viên active của lớp có gate đang mở trên bài dùng file', async () => {
      prisma.file.findUnique.mockResolvedValue(file);
      prisma.lessonActivity.findMany.mockResolvedValue([{ lessonId: 'l1' }, { lessonId: 'l1' }]);
      prisma.classMember.findFirst.mockResolvedValue({ id: 'cm1' });

      await expect(service.download('file1', 'student1')).resolves.toMatchObject({ fileName: 'slide.pdf' });

      const where = prisma.classMember.findFirst.mock.calls[0][0].where;
      expect(where).toMatchObject({ userId: 'student1', status: 'active' });
      expect(where.OR[0].class.gates.some).toMatchObject({ lessonId: { in: ['l1'] }, isActive: true });
    });
  });

  describe('sanitizeFileName', () => {
    it('bỏ đường dẫn và ký tự nguy hiểm cho Content-Disposition', () => {
      expect(sanitizeFileName('C:\\tmp\\bai-1.pdf')).toBe('bai-1.pdf');
      expect(sanitizeFileName('a"b.pdf')).toBe('ab.pdf');
      expect(sanitizeFileName('')).toBe('document.pdf');
      expect(sanitizeFileName(undefined)).toBe('document.pdf');
    });

    it('giữ nguyên dấu tiếng Việt (không lọc mất ký tự Unicode)', () => {
      expect(sanitizeFileName('Bài 10. Kiểu dữ liệu.pdf')).toBe('Bài 10. Kiểu dữ liệu.pdf');
    });
  });

  describe('decodeMultipartFileName', () => {
    it('giải mojibake latin1 của busboy về đúng UTF-8', () => {
      const utf8 = 'Bài 10. Kiểu dữ liệu Danh sách.pdf';
      // Mô phỏng đúng thứ busboy đưa vào: bytes UTF-8 nhưng được đọc như latin1.
      const asBusboySees = Buffer.from(utf8, 'utf8').toString('latin1');
      expect(asBusboySees).not.toBe(utf8);
      expect(decodeMultipartFileName(asBusboySees)).toBe(utf8);
    });

    it('không đụng tên ASCII', () => {
      expect(decodeMultipartFileName('slide-01.pdf')).toBe('slide-01.pdf');
    });

    it('giữ nguyên tên vốn đã đúng UTF-8 (không giải mã hai lần)', () => {
      expect(decodeMultipartFileName('Bài 10.pdf')).toBe('Bài 10.pdf');
    });

    it('giữ nguyên khi dãy byte không phải UTF-8 hợp lệ', () => {
      expect(decodeMultipartFileName('café.pdf')).toBe('café.pdf');
    });

    it('bỏ qua giá trị rỗng/undefined', () => {
      expect(decodeMultipartFileName(undefined)).toBeUndefined();
      expect(decodeMultipartFileName('')).toBe('');
    });
  });

  describe('upload — tên file có dấu', () => {
    it('lưu fileName đã giải mã đúng UTF-8', async () => {
      const utf8 = 'Bài 10. Kiểu dữ liệu.pdf';
      const asBusboySees = Buffer.from(utf8, 'utf8').toString('latin1');
      await service.upload(makeFile({ originalname: asBusboySees }), 'owner1');
      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fileName: utf8 }) }),
      );
    });
  });
});
