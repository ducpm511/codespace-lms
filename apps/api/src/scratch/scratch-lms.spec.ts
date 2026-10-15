import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { ScratchLmsService } from './scratch-lms.service';
import type { ScratchAccessService } from './scratch-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import type { StorageAdapter } from '../common/storage/storage.interface';

const A = `${'a'.repeat(32)}.png`;
const LATER = `${'b'.repeat(32)}.png`; // asset dự án có thêm SAU khi nộp

describe('ScratchLmsService', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let transaction: jest.Mock;
  let access: { editable: jest.Mock };
  let rbac: { getEffectivePermissions: jest.Mock; hasPermission: jest.Mock };
  let storage: { get: jest.Mock };
  let service: ScratchLmsService;

  const activity = (over: Record<string, unknown> = {}) => ({
    type: 'scratch',
    title: 'Mê cung của em',
    refId: 'tpl',
    lessonId: 'l1',
    lesson: { title: 'Bài 1', section: { courseId: 'c1' } },
    ...over,
  });

  beforeEach(() => {
    prisma = {
      lessonActivity: { findUnique: jest.fn().mockResolvedValue(activity()) },
      classMember: { findUnique: jest.fn().mockResolvedValue({ status: 'active' }) },
      classCourse: { findUnique: jest.fn().mockResolvedValue({ id: 'cc' }) },
      lessonGate: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      scratchActivityCopy: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      scratchProject: {
        findUnique: jest.fn().mockResolvedValue({
          title: 'Mẫu của cô',
          deletedAt: null,
          versions: [{ projectJson: { targets: [{ costumes: [{ md5ext: A }] }] }, sizeBytes: 50 }],
        }),
        create: jest.fn().mockResolvedValue({ id: 'copy' }),
      },
      scratchProjectVersion: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      scratchProjectAsset: {
        findMany: jest.fn().mockResolvedValue([{ md5ext: A }]),
        createMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ asset: { storageKey: 'k', mime: 'image/png' } }),
      },
      submission: { findUnique: jest.fn() },
    };
    transaction = jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    Object.assign(prisma, { $transaction: transaction });
    access = { editable: jest.fn().mockResolvedValue({}) };
    rbac = {
      getEffectivePermissions: jest.fn().mockResolvedValue({}),
      hasPermission: jest.fn().mockReturnValue(false),
    };
    storage = { get: jest.fn().mockResolvedValue(Buffer.from('x')) };
    service = new ScratchLmsService(
      prisma as unknown as PrismaService,
      access as unknown as ScratchAccessService,
      rbac as unknown as RbacService,
      storage as unknown as StorageAdapter,
    );
  });

  describe('openActivity', () => {
    it('lần đầu: tạo bản sao private của mẫu (phiên bản + tham chiếu asset) và liên kết với hoạt động', async () => {
      await expect(service.openActivity('act', 'class-1', 'stu')).resolves.toEqual({
        projectId: 'copy',
        created: true,
      });
      expect(prisma.scratchProject.create).toHaveBeenCalledWith({
        data: { ownerId: 'stu', title: 'Mê cung của em' },
        select: { id: true },
      });
      expect(prisma.scratchProjectVersion.create.mock.calls[0][0].data).toMatchObject({ projectId: 'copy', seq: 1 });
      expect(prisma.scratchProjectAsset.createMany.mock.calls[0][0].data).toEqual([{ projectId: 'copy', md5ext: A }]);
      expect(prisma.scratchActivityCopy.create).toHaveBeenCalledWith({
        data: { activityId: 'act', userId: 'stu', projectId: 'copy' },
      });
    });

    it('đã có bản sao ⇒ trả lại đúng bản đó, không tạo thêm', async () => {
      prisma.scratchActivityCopy.findUnique.mockResolvedValue({ projectId: 'mine', project: { deletedAt: null } });
      await expect(service.openActivity('act', 'class-1', 'stu')).resolves.toEqual({
        projectId: 'mine',
        created: false,
      });
      expect(prisma.scratchProject.create).not.toHaveBeenCalled();
    });

    it('em đã xóa bản sao ⇒ bỏ liên kết cũ, tạo bản mới', async () => {
      prisma.scratchActivityCopy.findUnique.mockResolvedValue({ projectId: 'old', project: { deletedAt: new Date() } });
      await expect(service.openActivity('act', 'class-1', 'stu')).resolves.toMatchObject({ created: true });
      expect(prisma.scratchActivityCopy.delete).toHaveBeenCalled();
    });

    it('không có mẫu ⇒ dự án trống (không phiên bản), tên theo hoạt động / bài học', async () => {
      prisma.lessonActivity.findUnique.mockResolvedValue(activity({ refId: null, title: null }));
      await service.openActivity('act', 'class-1', 'stu');
      expect(prisma.scratchProject.create.mock.calls[0][0].data.title).toBe('Bài 1');
      expect(prisma.scratchProjectVersion.create).not.toHaveBeenCalled();
    });

    it('bấm đúp (P2002) ⇒ trả bản của request thắng', async () => {
      transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
      );
      prisma.scratchActivityCopy.findUniqueOrThrow.mockResolvedValue({ projectId: 'winner' });
      await expect(service.openActivity('act', 'class-1', 'stu')).resolves.toEqual({
        projectId: 'winner',
        created: false,
      });
    });

    it('chặn: không phải thành viên (403), bài chưa mở (403), khóa không thuộc lớp / sai loại (404), mẫu đã xóa (404)', async () => {
      prisma.classMember.findUnique.mockResolvedValueOnce({ status: 'removed' });
      await expect(service.openActivity('act', 'class-1', 'stu')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.lessonGate.findUnique.mockResolvedValueOnce({ isActive: false });
      await expect(service.openActivity('act', 'class-1', 'stu')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.classCourse.findUnique.mockResolvedValueOnce(null);
      await expect(service.openActivity('act', 'class-1', 'stu')).rejects.toBeInstanceOf(NotFoundException);
      prisma.lessonActivity.findUnique.mockResolvedValueOnce(activity({ type: 'quiz' }));
      await expect(service.openActivity('act', 'class-1', 'stu')).rejects.toBeInstanceOf(NotFoundException);
      prisma.scratchProject.findUnique.mockResolvedValueOnce({ title: 'x', deletedAt: new Date(), versions: [] });
      await expect(service.openActivity('act', 'class-1', 'stu')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.scratchProject.create).not.toHaveBeenCalled();
    });
  });

  describe('freezeLatest', () => {
    it('đóng băng phiên bản mới nhất (chỉ khi dự án mình sửa được)', async () => {
      prisma.scratchProjectVersion.findFirst.mockResolvedValue({ id: 'v9', frozenAt: null });
      await expect(service.freezeLatest('p1', 'stu', prisma as never)).resolves.toBe('v9');
      expect(access.editable).toHaveBeenCalledWith('p1', 'stu');
      expect(prisma.scratchProjectVersion.update.mock.calls[0][0].where).toEqual({ id: 'v9' });
    });

    it('đã đóng băng thì giữ nguyên; chưa lưu lần nào ⇒ 400; không sửa được ⇒ lỗi quyền', async () => {
      prisma.scratchProjectVersion.findFirst.mockResolvedValue({ id: 'v9', frozenAt: new Date() });
      await service.freezeLatest('p1', 'stu', prisma as never);
      expect(prisma.scratchProjectVersion.update).not.toHaveBeenCalled();
      prisma.scratchProjectVersion.findFirst.mockResolvedValue(null);
      await expect(service.freezeLatest('p1', 'stu', prisma as never)).rejects.toBeInstanceOf(BadRequestException);
      access.editable.mockRejectedValue(new NotFoundException());
      await expect(service.freezeLatest('p9', 'stu', prisma as never)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('xem bài nộp', () => {
    const sub = {
      userId: 'stu',
      classId: 'class-1',
      scratchVersion: { projectId: 'p1', projectJson: { targets: [{ costumes: [{ md5ext: A }] }] } },
    };

    it('học viên nộp bài xem được; GV có quyền theo lớp xem được; người khác 403', async () => {
      prisma.submission.findUnique.mockResolvedValue(sub);
      await expect(service.submissionJson('s1', 'stu')).resolves.toEqual(sub.scratchVersion.projectJson);
      await expect(service.submissionJson('s1', 'stranger')).rejects.toBeInstanceOf(ForbiddenException);
      rbac.hasPermission.mockImplementation((_e, _p, scope) => scope === 'class-1');
      await expect(service.submissionJson('s1', 'teacher')).resolves.toBeDefined();
    });

    it('chỉ phục vụ asset mà PHIÊN BẢN đã nộp dùng (asset thêm sau khi nộp ⇒ 404)', async () => {
      prisma.submission.findUnique.mockResolvedValue(sub);
      await expect(service.submissionAsset('s1', A, 'stu')).resolves.toMatchObject({ mime: 'image/png' });
      await expect(service.submissionAsset('s1', LATER, 'stu')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('bài nộp không có dự án ⇒ 404', async () => {
      prisma.submission.findUnique.mockResolvedValue({ ...sub, scratchVersion: null });
      await expect(service.submissionJson('s1', 'stu')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
