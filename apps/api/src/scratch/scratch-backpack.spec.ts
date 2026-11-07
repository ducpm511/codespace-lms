import { createHash } from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SCRATCH_BACKPACK_ITEM_MAX_BYTES,
  SCRATCH_BACKPACK_MAX_ITEMS,
  SCRATCH_BACKPACK_QUOTA_BYTES,
  SCRATCH_BACKPACK_THUMBNAIL_MAX_BYTES,
} from '@lms/contracts';
import { ScratchBackpackService, checkBody } from './scratch-backpack.service';
import { ScratchBackpackController } from './scratch-backpack.controller';
import { CreateScratchBackpackItemDto, ListScratchBackpackQueryDto } from './dto/backpack.dto';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageAdapter } from '../common/storage/storage.interface';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVEfmt ')]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 9, 9]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const SCRIPT = Buffer.from(JSON.stringify([{ id: 'a', opcode: 'motion_movesteps' }]));

const row = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  type: 'costume',
  name: 'Rex',
  mime: 'image/png',
  md5ext: `${'a'.repeat(32)}.png`,
  sizeBytes: 11,
  thumbnail: JPEG,
  createdAt: new Date(0),
  ...over,
});

describe('ScratchBackpackService', () => {
  let tx: { $executeRaw: jest.Mock; scratchBackpackItem: Record<string, jest.Mock> };
  let prisma: Record<string, unknown> & { scratchBackpackItem: Record<string, jest.Mock> };
  let storage: { provider: string; put: jest.Mock; get: jest.Mock; delete: jest.Mock };
  let service: ScratchBackpackService;

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      scratchBackpackItem: {
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { sizeBytes: null } }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ createdAt: new Date(0), ...data })),
      },
    };
    prisma = {
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
      scratchBackpackItem: {
        findMany: jest.fn().mockResolvedValue([row()]),
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    storage = { provider: 'local', put: jest.fn().mockResolvedValue('k'), get: jest.fn(), delete: jest.fn() };
    service = new ScratchBackpackService(prisma as unknown as PrismaService, storage as unknown as StorageAdapter);
  });

  describe('quyền sở hữu (IDOR)', () => {
    it('list chỉ lấy mục của người gọi, đúng offset/limit, ảnh thu nhỏ base64', async () => {
      const items = await service.list('me', 20, 20);
      expect(prisma.scratchBackpackItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'me' }, skip: 20, take: 20 }),
      );
      expect(items[0]).toMatchObject({ id: 'i1', thumbnail: JPEG.toString('base64'), createdAt: new Date(0).toISOString() });
      expect(items[0]).not.toHaveProperty('storageKey');
      expect(items[0]).not.toHaveProperty('userId');
    });

    it('đọc nội dung mục của người khác ⇒ 404, không chạm storage', async () => {
      await expect(service.body('me', 'not-mine')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.scratchBackpackItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'not-mine', userId: 'me' } }),
      );
      expect(storage.get).not.toHaveBeenCalled();
    });

    it('đọc nội dung mục của mình', async () => {
      prisma.scratchBackpackItem.findFirst.mockResolvedValue({ storageKey: 'scratch-backpack/i1', mime: 'image/png' });
      storage.get.mockResolvedValue(PNG);
      await expect(service.body('me', 'i1')).resolves.toEqual({ buffer: PNG, mime: 'image/png' });
    });

    it('xóa mục của người khác ⇒ 404, không xóa gì', async () => {
      await expect(service.remove('me', 'not-mine')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.scratchBackpackItem.deleteMany).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('xóa mục của mình: lọc cả userId rồi xóa file', async () => {
      prisma.scratchBackpackItem.findFirst.mockResolvedValue({ storageKey: 'scratch-backpack/i1' });
      await service.remove('me', 'i1');
      expect(prisma.scratchBackpackItem.deleteMany).toHaveBeenCalledWith({ where: { id: 'i1', userId: 'me' } });
      expect(storage.delete).toHaveBeenCalledWith('scratch-backpack/i1');
    });

    it('xóa file lỗi không làm hỏng thao tác', async () => {
      prisma.scratchBackpackItem.findFirst.mockResolvedValue({ storageKey: 'scratch-backpack/i1' });
      storage.delete.mockRejectedValue(new Error('disk'));
      await expect(service.remove('me', 'i1')).resolves.toBeUndefined();
    });

    it('controller không có route nào nhận userId', () => {
      const proto = ScratchBackpackController.prototype as unknown as Record<string, () => unknown>;
      const paths = ['list', 'add', 'body', 'remove'].map((m) => String(Reflect.getMetadata(PATH_METADATA, proto[m])));
      expect(paths).toEqual(['/', '/', ':id/body', ':id']);
      expect(Reflect.getMetadata(PATH_METADATA, ScratchBackpackController)).toBe('scratch/backpack');
    });
  });

  describe('thêm mục + giới hạn', () => {
    it('costume PNG: md5ext + mime do server suy từ nội dung, gắn với người gọi, có khóa hạn mức', async () => {
      const item = await service.add('me', { type: 'costume', name: '  Rex  ' }, PNG, JPEG);
      const md5 = createHash('md5').update(PNG).digest('hex');
      expect(item).toMatchObject({ type: 'costume', name: 'Rex', mime: 'image/png', md5ext: `${md5}.png`, sizeBytes: PNG.length });
      const data = tx.scratchBackpackItem.create.mock.calls[0][0].data;
      expect(data.userId).toBe('me');
      expect(data.storageKey).toBe(`scratch-backpack/${data.id}`);
      expect(storage.put).toHaveBeenCalledWith(data.storageKey, PNG, 'image/png');
      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.scratchBackpackItem.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'me' } }));
    });

    it('ba lô đủ số mục ⇒ 400, không tạo dòng, xóa file vừa ghi', async () => {
      tx.scratchBackpackItem.aggregate.mockResolvedValue({
        _count: { _all: SCRATCH_BACKPACK_MAX_ITEMS },
        _sum: { sizeBytes: 10 },
      });
      await expect(service.add('me', { type: 'sound', name: 'pop' }, WAV, JPEG)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.scratchBackpackItem.create).not.toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    });

    it('vượt tổng dung lượng ⇒ 400', async () => {
      tx.scratchBackpackItem.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _sum: { sizeBytes: SCRATCH_BACKPACK_QUOTA_BYTES - 1 },
      });
      await expect(service.add('me', { type: 'sprite', name: 'Rex' }, ZIP, JPEG)).rejects.toThrow(/MB/);
      expect(tx.scratchBackpackItem.create).not.toHaveBeenCalled();
    });

    it('mục quá cỡ / thiếu nội dung ⇒ 400 trước khi ghi file', async () => {
      const big = Buffer.alloc(SCRATCH_BACKPACK_ITEM_MAX_BYTES + 1);
      await expect(service.add('me', { type: 'sprite', name: 'x' }, big, JPEG)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.add('me', { type: 'sprite', name: 'x' }, undefined, JPEG)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('ảnh thu nhỏ không phải JPEG hoặc quá cỡ ⇒ 400', async () => {
      await expect(service.add('me', { type: 'costume', name: 'x' }, PNG, PNG)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const bigThumb = Buffer.concat([JPEG, Buffer.alloc(SCRATCH_BACKPACK_THUMBNAIL_MAX_BYTES)]);
      await expect(service.add('me', { type: 'costume', name: 'x' }, PNG, bigThumb)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.add('me', { type: 'costume', name: 'x' }, PNG, undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.put).not.toHaveBeenCalled();
    });
  });

  describe('checkBody', () => {
    it('nhận đúng định dạng theo loại', () => {
      expect(checkBody('costume', SVG)).toMatchObject({ mime: 'image/svg+xml' });
      expect(checkBody('costume', SVG).md5ext).toMatch(/^[0-9a-f]{32}\.svg$/);
      expect(checkBody('sound', WAV)).toMatchObject({ mime: 'audio/x-wav' });
      expect(checkBody('sprite', ZIP)).toEqual({ mime: 'application/zip', md5ext: null });
      expect(checkBody('script', SCRIPT)).toEqual({ mime: 'application/json', md5ext: null });
    });

    it('chặn nội dung lệch loại', () => {
      expect(() => checkBody('costume', WAV)).toThrow(BadRequestException);
      expect(() => checkBody('sound', PNG)).toThrow(BadRequestException);
      expect(() => checkBody('sprite', PNG)).toThrow(BadRequestException);
      expect(() => checkBody('script', Buffer.from('not json'))).toThrow(BadRequestException);
      expect(() => checkBody('script', Buffer.from('{"a":1}'))).toThrow(BadRequestException);
      expect(() => checkBody('script', Buffer.from('[]'))).toThrow(BadRequestException);
    });
  });

  describe('DTO allowlist', () => {
    const opts = { whitelist: true, forbidNonWhitelisted: true };

    it('chỉ nhận type trong allowlist, tên không rỗng, không trường lạ', async () => {
      const ok = await validate(plainToInstance(CreateScratchBackpackItemDto, { type: 'sprite', name: 'Rex' }), opts);
      expect(ok).toHaveLength(0);
      const bad = await validate(
        plainToInstance(CreateScratchBackpackItemDto, { type: 'project', name: '  ', userId: 'other', mime: 'x' }),
        opts,
      );
      expect(bad.map((e) => e.property).sort()).toEqual(['mime', 'name', 'type', 'userId']);
    });

    it('phân trang: limit tối đa 40, offset không âm', async () => {
      const ok = plainToInstance(ListScratchBackpackQueryDto, { offset: '20', limit: '20' });
      expect(await validate(ok, opts)).toHaveLength(0);
      expect(ok).toMatchObject({ offset: 20, limit: 20 });
      const bad = await validate(plainToInstance(ListScratchBackpackQueryDto, { offset: '-1', limit: '41' }), opts);
      expect(bad.map((e) => e.property).sort()).toEqual(['limit', 'offset']);
    });
  });
});
