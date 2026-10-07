import { createHash } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@lms/database';
import { SCRATCH_KEEP_UNFROZEN_VERSIONS, SCRATCH_USER_QUOTA_BYTES } from '@lms/contracts';
import { ScratchProjectsService } from './scratch-projects.service';
import { ScratchAssetsService } from './scratch-assets.service';
import { UpdateScratchProjectDto } from './dto/update-scratch-project.dto';
import type { ScratchAccessService, ScratchProjectAccess } from './scratch-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageAdapter } from '../common/storage/storage.interface';

const p2002 = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
const access = (over: Partial<ScratchProjectAccess> = {}): ScratchProjectAccess => ({
  id: 'p1',
  ownerId: 'owner',
  visibility: 'private',
  classId: null,
  isOwner: true,
  canEdit: true,
  ...over,
});

function makeStorage() {
  return { provider: 'local', put: jest.fn().mockResolvedValue('k'), get: jest.fn(), delete: jest.fn() };
}

describe('ScratchProjectsService', () => {
  let tx: Record<string, Record<string, jest.Mock>>;
  let prisma: Record<string, unknown>;
  let acc: Record<keyof ScratchAccessService, jest.Mock>;
  let storage: ReturnType<typeof makeStorage>;
  let service: ScratchProjectsService;

  beforeEach(() => {
    tx = {
      scratchProject: { update: jest.fn() },
      auditLog: { create: jest.fn() },
      scratchProjectVersion: {
        findFirst: jest.fn().mockResolvedValue({ seq: 30 }),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'v', frozenAt: null, createdAt: new Date(0), ...data }),
          ),
        deleteMany: jest.fn(),
      },
      scratchAsset: { findMany: jest.fn().mockResolvedValue([{ md5ext: `${'a'.repeat(32)}.svg` }]) },
      scratchProjectAsset: { createMany: jest.fn() },
    };
    prisma = {
      ...tx,
      $transaction: jest.fn().mockImplementation((arg) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
      scratchProjectAsset: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    acc = {
      readable: jest.fn().mockResolvedValue(access()),
      editable: jest.fn().mockResolvedValue(access()),
      owned: jest.fn().mockResolvedValue(access()),
      belongsToClass: jest.fn().mockResolvedValue(false),
    } as unknown as Record<keyof ScratchAccessService, jest.Mock>;
    storage = makeStorage();
    service = new ScratchProjectsService(
      prisma as unknown as PrismaService,
      acc as unknown as ScratchAccessService,
      storage as unknown as StorageAdapter,
    );
    jest.spyOn(service, 'detail').mockResolvedValue({} as never);
  });

  describe('update (chia sẻ)', () => {
    it('DTO không cho học viên tự đặt public', async () => {
      const errors = await validate(plainToInstance(UpdateScratchProjectDto, { visibility: 'public' }));
      expect(errors.map((e) => e.property)).toContain('visibility');
    });

    it('chia sẻ vào lớp mình KHÔNG thuộc → 403, không ghi gì', async () => {
      await expect(
        service.update('p1', { visibility: 'class', classId: 'other' }, { userId: 'owner' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.scratchProject.update).not.toHaveBeenCalled();
    });

    it('chia sẻ vào lớp mình học → lưu + audit cùng transaction', async () => {
      acc.belongsToClass.mockResolvedValue(true);
      await service.update('p1', { visibility: 'class', classId: 'c1' }, { userId: 'owner', ip: '1.2.3.4' });
      expect(tx.scratchProject.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { visibility: 'class', classId: 'c1' },
      });
      expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'scratch.project.share',
        entityId: 'p1',
        metaJson: { from: 'private', to: 'class', toClassId: 'c1' },
      });
    });

    it('chỉ đổi tên → không audit', async () => {
      await service.update('p1', { title: '  Mèo? Không, Rex  ' }, { userId: 'owner' });
      expect(tx.scratchProject.update.mock.calls[0][0].data.title).toBe('Mèo? Không, Rex');
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    });

    it('không phải chủ → lỗi quyền từ access, không ghi', async () => {
      acc.owned.mockRejectedValue(new ForbiddenException());
      await expect(service.update('p1', { title: 'x' }, { userId: 'collab' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tx.scratchProject.update).not.toHaveBeenCalled();
    });

    it('dự án đang public → không đổi phạm vi ở đây', async () => {
      acc.owned.mockResolvedValue(access({ visibility: 'public' }));
      await expect(service.update('p1', { visibility: 'private' }, { userId: 'owner' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('saveVersion', () => {
    const json = Buffer.from(
      JSON.stringify({
        targets: [{ costumes: [{ md5ext: `${'a'.repeat(32)}.svg` }, { md5ext: `${'c'.repeat(32)}.png` }] }],
        meta: {},
      }),
    );

    it('seq kế tiếp, chỉ gắn asset đã có trên server, dọn bản chưa đóng băng cũ', async () => {
      const v = await service.saveVersion('p1', json, 'owner');
      expect(v.seq).toBe(31);
      expect(tx.scratchProjectAsset.createMany).toHaveBeenCalledWith({
        data: [{ projectId: 'p1', md5ext: `${'a'.repeat(32)}.svg` }],
        skipDuplicates: true,
      });
      expect(tx.scratchProjectVersion.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', frozenAt: null, seq: { lte: 31 - SCRATCH_KEEP_UNFROZEN_VERSIONS } },
      });
    });

    it('không sửa được → không lưu', async () => {
      acc.editable.mockRejectedValue(new ForbiddenException());
      await expect(service.saveVersion('p1', json, 'classmate')).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.scratchProjectVersion.create).not.toHaveBeenCalled();
    });

    it('trùng seq (lưu đồng thời) → thử lại, quá số lần → 409', async () => {
      tx.scratchProjectVersion.create.mockRejectedValueOnce(p2002());
      await expect(service.saveVersion('p1', json, 'owner')).resolves.toMatchObject({ seq: 31 });
      tx.scratchProjectVersion.create.mockRejectedValue(p2002());
      await expect(service.saveVersion('p1', json, 'owner')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('asset', () => {
    const name = `${'a'.repeat(32)}.svg`;

    it('asset không thuộc dự án → 404, không đọc storage', async () => {
      await expect(service.asset('p1', name, 'owner')).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.get).not.toHaveBeenCalled();
    });

    it('không xem được dự án → lỗi của access, không đọc storage', async () => {
      acc.readable.mockRejectedValue(new NotFoundException());
      await expect(service.asset('p1', name, 'stranger')).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.get).not.toHaveBeenCalled();
    });

    it('thuộc dự án + xem được → trả nội dung', async () => {
      (prisma.scratchProjectAsset as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        asset: { storageKey: 'scratch-assets/x', mime: 'image/svg+xml' },
      });
      storage.get.mockResolvedValue(Buffer.from('<svg/>'));
      await expect(service.asset('p1', name, 'classmate')).resolves.toMatchObject({ mime: 'image/svg+xml' });
    });
  });
});

describe('ScratchAssetsService', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x')]);
  const name = `${createHash('md5').update(png).digest('hex')}.png`;
  let prisma: {
    scratchAsset: { findUnique: jest.Mock; aggregate: jest.Mock; create: jest.Mock };
  };
  let storage: ReturnType<typeof makeStorage>;
  let service: ScratchAssetsService;

  beforeEach(() => {
    prisma = {
      scratchAsset: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: 0 } }),
        create: jest.fn(),
      },
    };
    storage = makeStorage();
    service = new ScratchAssetsService(prisma as unknown as PrismaService, storage as unknown as StorageAdapter);
  });

  it('mới → lưu private với khóa do server dựng', async () => {
    await expect(service.upload(name, png, 'u1')).resolves.toEqual({
      md5ext: name,
      sizeBytes: png.length,
      created: true,
    });
    expect(storage.put).toHaveBeenCalledWith(`scratch-assets/${name}`, png, 'image/png');
    expect(prisma.scratchAsset.create.mock.calls[0][0].data).toMatchObject({ uploadedById: 'u1', mime: 'image/png' });
  });

  it('đã có (cùng nội dung) → không lưu lại, không tính hạn mức', async () => {
    prisma.scratchAsset.findUnique.mockResolvedValue({ sizeBytes: png.length });
    await expect(service.upload(name, png, 'u1')).resolves.toMatchObject({ created: false });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('vượt hạn mức → 400, không lưu', async () => {
    prisma.scratchAsset.aggregate.mockResolvedValue({ _sum: { sizeBytes: SCRATCH_USER_QUOTA_BYTES } });
    await expect(service.upload(name, png, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('hai người tải cùng lúc (P2002) → coi như đã có', async () => {
    prisma.scratchAsset.create.mockRejectedValue(p2002());
    await expect(service.upload(name, png, 'u1')).resolves.toMatchObject({ created: false });
  });
});
