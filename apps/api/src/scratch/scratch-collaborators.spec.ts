import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SCRATCH_MAX_COLLABORATORS } from '@lms/contracts';
import { ScratchCollaboratorsService, maskEmail } from './scratch-collaborators.service';
import type { ScratchAccessService } from './scratch-access.service';
import type { CollabGateway } from './collab/collab.gateway';
import type { PrismaService } from '../prisma/prisma.service';

const OWNER = { userId: 'owner', ip: '1.2.3.4' };

describe('ScratchCollaboratorsService', () => {
  let tx: Record<string, Record<string, jest.Mock>>;
  let prisma: {
    user: Record<string, jest.Mock>;
    scratchCollaborator: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let access: { owned: jest.Mock; editable: jest.Mock };
  let gateway: { kick: jest.Mock };
  let service: ScratchCollaboratorsService;

  beforeEach(() => {
    tx = {
      scratchCollaborator: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      scratchProject: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ title: 'Mê cung', owner: { fullName: 'An' } }),
      },
      notification: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u2', fullName: 'Bình', email: 'binh.le@codespace.vn' }]),
        findUnique: jest.fn().mockResolvedValue({ status: 'active' }),
      },
      scratchCollaborator: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    access = {
      owned: jest.fn().mockResolvedValue({ isOwner: true }),
      editable: jest.fn().mockResolvedValue({ isOwner: true }),
    };
    gateway = { kick: jest.fn() };
    service = new ScratchCollaboratorsService(
      prisma as unknown as PrismaService,
      access as unknown as ScratchAccessService,
      gateway as unknown as CollabGateway,
    );
  });

  it('che email: giữ 2 ký tự đầu + tên miền', () => {
    expect(maskEmail('binh.le@codespace.vn')).toBe('bi***@codespace.vn');
    expect(maskEmail('a@x.vn')).toBe('a***@x.vn');
    expect(maskEmail('khong-hop-le')).toBe('***');
  });

  describe('candidates', () => {
    it('chỉ chủ dự án tìm được (không phải chủ → lỗi quyền, không truy vấn người dùng)', async () => {
      access.owned.mockRejectedValue(new ForbiddenException());
      await expect(service.candidates('p1', 'bi', 'collab')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('chuỗi quá ngắn → rỗng, không truy vấn', async () => {
      await expect(service.candidates('p1', ' b ', 'owner')).resolves.toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('chỉ tài khoản đang hoạt động, bỏ chính mình + người đã là đồng tác giả; email bị che', async () => {
      await expect(service.candidates('p1', 'bi', 'owner')).resolves.toEqual([
        { userId: 'u2', fullName: 'Bình', emailHint: 'bi***@codespace.vn' },
      ]);
      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        status: 'active',
        id: { not: 'owner' },
        scratchCollabs: { none: { projectId: 'p1' } },
      });
      // Không bao giờ trả email đầy đủ.
      expect(prisma.user.findMany.mock.calls[0][0].select).toEqual({ id: true, fullName: true, email: true });
    });
  });

  describe('add', () => {
    it('mời: tạo đồng tác giả + thông báo + audit trong CÙNG transaction', async () => {
      await service.add('p1', 'u2', OWNER);
      expect(tx.scratchCollaborator.create).toHaveBeenCalledWith({
        data: { projectId: 'p1', userId: 'u2', invitedById: 'owner' },
      });
      expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({
        userId: 'u2',
        type: 'scratch.collab.invited',
      });
      expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'scratch.collab.add',
        entityId: 'p1',
        metaJson: { userId: 'u2' },
      });
    });

    it('mời lại người đã là đồng tác giả → không tạo / báo / ghi gì thêm', async () => {
      tx.scratchCollaborator.findMany.mockResolvedValue([{ userId: 'u2' }]);
      await service.add('p1', 'u2', OWNER);
      expect(tx.scratchCollaborator.create).not.toHaveBeenCalled();
      expect(tx.notification.create).not.toHaveBeenCalled();
    });

    it(`quá ${SCRATCH_MAX_COLLABORATORS} đồng tác giả → 409`, async () => {
      tx.scratchCollaborator.findMany.mockResolvedValue(
        Array.from({ length: SCRATCH_MAX_COLLABORATORS }, (_, i) => ({ userId: `x${i}` })),
      );
      await expect(service.add('p1', 'u2', OWNER)).rejects.toBeInstanceOf(ConflictException);
    });

    it('mời chính mình → 400; người không tồn tại / bị khóa → 404', async () => {
      await expect(service.add('p1', 'owner', OWNER)).rejects.toBeInstanceOf(BadRequestException);
      prisma.user.findUnique.mockResolvedValue({ status: 'suspended' });
      await expect(service.add('p1', 'u2', OWNER)).rejects.toBeInstanceOf(NotFoundException);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.add('p1', 'u2', OWNER)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('không phải chủ → lỗi quyền', async () => {
      access.owned.mockRejectedValue(new ForbiddenException());
      await expect(service.add('p1', 'u2', { userId: 'collab' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('chủ gỡ đồng tác giả → audit remove + đá khỏi phòng SAU khi commit', async () => {
      await service.remove('p1', 'u2', OWNER);
      expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.collab.remove');
      expect(gateway.kick).toHaveBeenCalledWith('p1', 'u2');
      expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(gateway.kick.mock.invocationCallOrder[0]);
    });

    it('đồng tác giả tự rời → audit leave; gỡ người khác → 403', async () => {
      access.editable.mockResolvedValue({ isOwner: false });
      await expect(service.remove('p1', 'u2', { userId: 'u2' })).resolves.toEqual([]);
      expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.collab.leave');
      await expect(service.remove('p1', 'u3', { userId: 'u2' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('chủ không tự rời; gỡ người không phải đồng tác giả → 404, không đá ai', async () => {
      await expect(service.remove('p1', 'owner', OWNER)).rejects.toBeInstanceOf(BadRequestException);
      tx.scratchCollaborator.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('p1', 'u9', OWNER)).rejects.toBeInstanceOf(NotFoundException);
      expect(gateway.kick).not.toHaveBeenCalled();
    });
  });
});
