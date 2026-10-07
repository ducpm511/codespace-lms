import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ScratchModeratorsService } from './scratch-moderators.service';
import { ScratchModerationService } from './scratch-moderation.service';
import { ScratchPublishingService } from './scratch-publishing.service';
import type { ScratchAccessService } from './scratch-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import type { StorageAdapter } from '../common/storage/storage.interface';

const A = `${'a'.repeat(32)}.png`; // trong bản ĐÃ DUYỆT
const B = `${'b'.repeat(32)}.png`; // chỉ thêm vào dự án SAU khi duyệt
const publishedJson = { targets: [{ costumes: [{ md5ext: A }] }], meta: {} };
const storage = () => ({
  provider: 'local',
  put: jest.fn(),
  get: jest.fn().mockResolvedValue(Buffer.from('x')),
  delete: jest.fn(),
});

describe('ScratchModeratorsService', () => {
  let rbacGlobal: boolean;
  let membership: object | null;
  let findFirst: jest.Mock;
  let svc: ScratchModeratorsService;

  beforeEach(() => {
    rbacGlobal = false;
    membership = null;
    findFirst = jest.fn().mockImplementation(() => Promise.resolve(membership));
    const rbac = {
      getEffectivePermissions: jest.fn().mockResolvedValue({}),
      hasPermission: jest.fn().mockImplementation(() => rbacGlobal),
    };
    svc = new ScratchModeratorsService(
      { classMember: { findFirst } } as unknown as PrismaService,
      rbac as unknown as RbacService,
    );
  });

  it('không ai tự duyệt bài mình — kể cả admin', async () => {
    rbacGlobal = true;
    await expect(svc.canModerate('u1', 'u1')).resolves.toBe(false);
  });

  it('admin (scratch.moderate) duyệt mọi học viên', async () => {
    rbacGlobal = true;
    await expect(svc.canModerate('admin', 'kid')).resolves.toBe(true);
  });

  it('GV: chỉ học viên (vai student, đang học) của lớp mình tạo hoặc dạy', async () => {
    await expect(svc.canModerate('teacher', 'kid')).resolves.toBe(false);
    membership = { id: 'm' };
    await expect(svc.canModerate('teacher', 'kid')).resolves.toBe(true);
    const where = findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'kid', status: 'active', roleInClass: 'student' });
    expect(where.class.OR).toEqual([
      { createdById: 'teacher' },
      { members: { some: { userId: 'teacher', status: 'active', roleInClass: { in: ['instructor', 'ta'] } } } },
    ]);
  });

  it('assertCanModerate → 403', async () => {
    await expect(svc.assertCanModerate('teacher', 'kid')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ScratchPublishingService', () => {
  type Mocks = Record<string, Record<string, jest.Mock>>;
  let prisma: Mocks;
  let tx: Mocks;
  let transaction: jest.Mock;
  let access: { owned: jest.Mock; readable: jest.Mock };
  let svc: ScratchPublishingService;
  let pub: Record<string, unknown> | null;

  beforeEach(() => {
    pub = {
      projectId: 'p1',
      publishedTitle: 'Rex đi dạo',
      publishedAt: new Date(0),
      publishedVersion: { projectJson: publishedJson },
      project: { deletedAt: null, owner: { scratchNickname: { approved: 'Rex Nhỏ' } } },
    };
    tx = {
      scratchProjectVersion: { update: jest.fn() },
      scratchPublication: {
        upsert: jest.fn().mockResolvedValue({ slug: 's', publishedVersionId: null, requestedVersionId: 'v2' }),
      },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      scratchNickname: {
        findUnique: jest.fn().mockResolvedValue({ approved: 'Rex Nhỏ', pending: null }),
        upsert: jest.fn(),
      },
      scratchProjectVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'v2', frozenAt: null }) },
      scratchPublication: {
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.slug ? pub : null)),
      },
      scratchProjectAsset: {
        findUnique: jest.fn().mockResolvedValue({ asset: { storageKey: 'k', mime: 'image/png' } }),
      },
      scratchProject: { findUniqueOrThrow: jest.fn().mockResolvedValue({ ownerId: 'owner' }) },
      scratchReport: { upsert: jest.fn() },
    };
    transaction = jest.fn().mockImplementation((fn) => fn(tx));
    access = { owned: jest.fn().mockResolvedValue({}), readable: jest.fn().mockResolvedValue({ isOwner: false }) };
    svc = new ScratchPublishingService(
      { ...prisma, $transaction: transaction } as unknown as PrismaService,
      access as unknown as ScratchAccessService,
      storage() as unknown as StorageAdapter,
    );
  });

  it('chỉ chủ dự án xin công khai', async () => {
    access.owned.mockRejectedValue(new ForbiddenException());
    await expect(svc.request('p1', undefined, { userId: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('chưa có biệt danh → 400', async () => {
    prisma.scratchNickname.findUnique.mockResolvedValue(null);
    await expect(svc.request('p1', undefined, { userId: 'owner' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('xin công khai: đóng băng bản mới nhất + audit', async () => {
    await svc.request('p1', undefined, { userId: 'owner' });
    expect(tx.scratchProjectVersion.update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: { frozenAt: expect.any(Date) },
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.public.request');
  });

  it('trang công khai: chỉ biệt danh — không họ tên', async () => {
    await expect(svc.publicProject('s')).resolves.toEqual({
      slug: 's',
      title: 'Rex đi dạo',
      nickname: 'Rex Nhỏ',
      publishedAt: new Date(0).toISOString(),
    });
  });

  it('asset thêm vào dự án SAU khi duyệt KHÔNG lộ qua link công khai (dù đã gắn vào dự án)', async () => {
    await expect(svc.publicAsset('s', A)).resolves.toMatchObject({ mime: 'image/png' });
    await expect(svc.publicAsset('s', B)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('đã gỡ / dự án đã xóa → 404', async () => {
    pub!.publishedVersion = null;
    await expect(svc.publicProjectJson('s')).rejects.toBeInstanceOf(NotFoundException);
    pub!.publishedVersion = { projectJson: publishedJson };
    pub!.project = { deletedAt: new Date(), owner: {} };
    await expect(svc.publicProject('s')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('không tự báo cáo dự án của mình', async () => {
    await expect(svc.reportPublic('s', { reason: 'other' }, 'owner')).rejects.toBeInstanceOf(BadRequestException);
    access.readable.mockResolvedValue({ isOwner: true });
    await expect(svc.report('p1', { reason: 'other' }, 'owner')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scratchReport.upsert).not.toHaveBeenCalled();
  });
});

describe('ScratchModerationService', () => {
  let tx: Record<string, Record<string, jest.Mock>>;
  let prisma: Record<string, unknown> & Record<string, Record<string, jest.Mock>>;
  let moderators: { assertCanModerate: jest.Mock; studentScope: jest.Mock };
  let svc: ScratchModerationService;

  beforeEach(() => {
    tx = {
      scratchPublication: { update: jest.fn(), updateMany: jest.fn() },
      scratchNickname: { update: jest.fn() },
      scratchReport: { update: jest.fn(), updateMany: jest.fn() },
      scratchProject: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      scratchPublication: {
        findUnique: jest.fn().mockResolvedValue({
          requestedVersionId: 'v2',
          requestedVersion: { projectJson: publishedJson },
          project: { ownerId: 'kid', title: 'Rex', deletedAt: null },
        }),
        update: jest.fn(),
      },
      scratchNickname: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'kid', approved: null, pending: 'Rex Nhỏ' }),
      },
      scratchReport: {
        findUnique: jest.fn().mockResolvedValue({ projectId: 'p1', resolvedAt: null, project: { ownerId: 'kid' } }),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((arg) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    } as never;
    moderators = { assertCanModerate: jest.fn().mockResolvedValue(undefined), studentScope: jest.fn() };
    svc = new ScratchModerationService(
      prisma as unknown as PrismaService,
      moderators as unknown as ScratchModeratorsService,
      storage() as unknown as StorageAdapter,
    );
  });

  it('không phải GV của học viên → 403, không ghi gì', async () => {
    moderators.assertCanModerate.mockRejectedValue(new ForbiddenException());
    await expect(svc.approve('p1', { userId: 'other' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.requestedJson('p1', 'other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('duyệt: bản chờ thành bản công khai, duyệt luôn biệt danh chờ, có audit', async () => {
    await svc.approve('p1', { userId: 'teacher' });
    expect(tx.scratchPublication.update.mock.calls[0][0].data).toMatchObject({
      publishedVersionId: 'v2',
      publishedTitle: 'Rex',
      requestedVersionId: null,
      decision: 'approved',
      decidedById: 'teacher',
    });
    expect(tx.scratchNickname.update.mock.calls[0][0].data).toMatchObject({ approved: 'Rex Nhỏ', pending: null });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.public.approve');
  });

  it('không có yêu cầu chờ → 404', async () => {
    prisma.scratchPublication.findUnique.mockResolvedValue({
      requestedVersionId: null,
      requestedVersion: null,
      project: { ownerId: 'kid', title: 'Rex', deletedAt: null },
    });
    await expect(svc.approve('p1', { userId: 'teacher' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('báo cáo → gỡ: thu về private, gỡ công khai, đóng mọi báo cáo mở của dự án', async () => {
    await svc.resolveReport('r1', 'remove', { userId: 'teacher' });
    expect(tx.scratchProject.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { visibility: 'private', classId: null },
    });
    expect(tx.scratchPublication.updateMany.mock.calls[0][0].data).toMatchObject({
      publishedVersionId: null,
      decision: 'removed',
    });
    expect(tx.scratchReport.updateMany.mock.calls[0][0].where).toEqual({ projectId: 'p1', resolvedAt: null });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.report.remove');
  });

  it('báo cáo đã xử lý → 409', async () => {
    prisma.scratchReport.findUnique.mockResolvedValue({
      projectId: 'p1',
      resolvedAt: new Date(),
      project: { ownerId: 'kid' },
    });
    await expect(svc.resolveReport('r1', 'dismiss', { userId: 'teacher' })).rejects.toBeInstanceOf(ConflictException);
  });
});
