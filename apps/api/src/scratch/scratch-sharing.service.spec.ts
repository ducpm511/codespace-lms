import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ScratchSharingService } from './scratch-sharing.service';
import type { ScratchAccessService } from './scratch-access.service';
import type { ScratchProjectsService } from './scratch-projects.service';
import type { PrismaService } from '../prisma/prisma.service';

const A = `${'a'.repeat(32)}.png`;
const B = `${'b'.repeat(32)}.wav`;
const OLD = `${'c'.repeat(32)}.svg`; // chỉ có ở phiên bản cũ đã bị thay

describe('ScratchSharingService', () => {
  let tx: Record<string, Record<string, jest.Mock>>;
  let prisma: Record<string, unknown> & {
    scratchProject: Record<string, jest.Mock>;
    scratchProjectAsset: Record<string, jest.Mock>;
    scratchProjectLike: Record<string, jest.Mock>;
  };
  let access: { readable: jest.Mock; belongsToClass: jest.Mock };
  let projects: { detail: jest.Mock };
  let service: ScratchSharingService;

  beforeEach(() => {
    tx = {
      scratchProject: { create: jest.fn().mockResolvedValue({ id: 'copy' }) },
      scratchProjectVersion: { create: jest.fn() },
      scratchProjectAsset: { createMany: jest.fn() },
    };
    prisma = {
      scratchProject: {
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          title: 'Mèo đuổi chuột',
          versions: [
            {
              projectJson: { targets: [{ costumes: [{ md5ext: A }], sounds: [{ md5ext: B }] }], meta: {} },
              sizeBytes: 99,
            },
          ],
        }),
      },
      scratchProjectAsset: { findMany: jest.fn().mockResolvedValue([{ md5ext: A }]) },
      scratchProjectLike: { createMany: jest.fn(), deleteMany: jest.fn(), count: jest.fn().mockResolvedValue(3) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    access = { readable: jest.fn().mockResolvedValue({}), belongsToClass: jest.fn().mockResolvedValue(false) };
    projects = { detail: jest.fn().mockResolvedValue({ id: 'copy' }) };
    service = new ScratchSharingService(
      prisma as unknown as PrismaService,
      access as unknown as ScratchAccessService,
      projects as unknown as ScratchProjectsService,
    );
  });

  describe('gallery', () => {
    it('lớp mình không thuộc → 403, không truy vấn dự án', async () => {
      await expect(service.gallery('class', 'c9', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.scratchProject.findMany).not.toHaveBeenCalled();
    });

    it('lớp mình thuộc → chỉ dự án chia sẻ đúng lớp đó, có nội dung, chưa xóa', async () => {
      access.belongsToClass.mockResolvedValue(true);
      await service.gallery('class', 'c1', 'u1');
      expect(prisma.scratchProject.findMany.mock.calls[0][0].where).toEqual({
        visibility: 'class',
        classId: 'c1',
        deletedAt: null,
        versions: { some: {} },
      });
    });

    it('cả trường → school + public, KHÔNG có private / class', async () => {
      await service.gallery('school', undefined, 'u1');
      expect(prisma.scratchProject.findMany.mock.calls[0][0].where.visibility).toEqual({ in: ['school', 'public'] });
    });

    it('scope class thiếu classId → 400', async () => {
      await expect(service.gallery('class', undefined, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remix', () => {
    it('không xem được dự án gốc → lỗi của access, không tạo gì', async () => {
      access.readable.mockRejectedValue(new NotFoundException());
      await expect(service.remix('src', undefined, 'u2')).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.scratchProject.create).not.toHaveBeenCalled();
    });

    it('dự án gốc chưa có phiên bản → 400', async () => {
      prisma.scratchProject.findUniqueOrThrow.mockResolvedValue({ title: 'x', versions: [] });
      await expect(service.remix('src', undefined, 'u2')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('bản sao riêng (private mặc định) của mình, giữ dòng dõi, phiên bản 1 = bản mới nhất', async () => {
      await service.remix('src', undefined, 'u2');
      expect(tx.scratchProject.create.mock.calls[0][0].data).toEqual({
        ownerId: 'u2',
        title: 'Mèo đuổi chuột (remix)',
        remixOfId: 'src',
      });
      expect(tx.scratchProjectVersion.create.mock.calls[0][0].data).toMatchObject({
        projectId: 'copy',
        seq: 1,
        savedById: 'u2',
      });
    });

    it('chỉ chép tham chiếu asset mà phiên bản mới nhất dùng VÀ dự án gốc có', async () => {
      await service.remix('src', undefined, 'u2');
      expect(prisma.scratchProjectAsset.findMany.mock.calls[0][0].where).toEqual({
        projectId: 'src',
        md5ext: { in: [A, B] },
      });
      expect(prisma.scratchProjectAsset.findMany.mock.calls[0][0].where.md5ext.in).not.toContain(OLD);
      expect(tx.scratchProjectAsset.createMany.mock.calls[0][0].data).toEqual([{ projectId: 'copy', md5ext: A }]);
    });
  });

  describe('like', () => {
    it('thích idempotent (skipDuplicates), trả số mới', async () => {
      await expect(service.setLike('p1', true, 'u1')).resolves.toEqual({ likeCount: 3, likedByMe: true });
      expect(prisma.scratchProjectLike.createMany).toHaveBeenCalledWith({
        data: [{ projectId: 'p1', userId: 'u1' }],
        skipDuplicates: true,
      });
    });

    it('bỏ thích chỉ xóa lượt của chính mình', async () => {
      await service.setLike('p1', false, 'u1');
      expect(prisma.scratchProjectLike.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1', userId: 'u1' } });
    });

    it('không xem được → không thích được', async () => {
      access.readable.mockRejectedValue(new NotFoundException());
      await expect(service.setLike('p1', true, 'u1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.scratchProjectLike.createMany).not.toHaveBeenCalled();
    });
  });
});
