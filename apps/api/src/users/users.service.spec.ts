import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: { findUnique: jest.fn(), findMany: jest.fn() },
    userRole: { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const now = new Date('2026-08-12T00:00:00.000Z');

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.c',
    fullName: 'A',
    status: 'active',
    avatarUrl: null,
    lastLoginAt: null,
    createdAt: now,
    roles: [{ role: { key: 'student' } }],
    ...over,
  };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('trả về items đã map + phân trang, không lộ passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([userRow()]);
      prisma.user.count.mockResolvedValue(1);
      const res = await service.list(1, 20);
      expect(res).toEqual({
        items: [{ id: 'u1', email: 'a@b.c', fullName: 'A', status: 'active', roles: ['student'], createdAt: now.toISOString() }],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('create', () => {
    it('409 khi email đã tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'exists' });
      await expect(
        service.create({ email: 'a@b.c', password: 'password1', fullName: 'A' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne (IDOR: not-found nhánh)', () => {
    it('404 khi user không tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trả UserDetail khi tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      const res = await service.findOne('u1');
      expect(res.id).toBe('u1');
      expect(res.roles).toEqual(['student']);
      expect(res).not.toHaveProperty('passwordHash');
    });
  });

  describe('assignRole', () => {
    it('404 khi role không tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' }); // ensureExists
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.assignRole('u1', 'ghost', null)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('idempotent: không tạo trùng nếu đã có', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' }); // ensureExists
      prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.user.findUnique.mockResolvedValueOnce(userRow()); // findOne cuối
      await service.assignRole('u1', 'student', null);
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });
  });
});
