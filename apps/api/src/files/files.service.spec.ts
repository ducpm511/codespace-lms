import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MAX_UPLOAD_BYTES } from '@lms/contracts';
import { FilesService, sanitizeFileName, type UploadedFileLike } from './files.service';
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
  });
});
