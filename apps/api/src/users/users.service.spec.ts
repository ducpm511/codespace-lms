import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { AuthService } from '../auth/auth.service';
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
    auditLog: { create: jest.fn() },
    // Hỗ trợ cả hai dạng: mảng operation và callback (transaction interactive).
    $transaction: jest.fn(),
  };
}

const ACTOR = { userId: 'admin-1', ip: '203.0.113.7' };

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

function makeAuth() {
  return { setPassword: jest.fn() };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let auth: ReturnType<typeof makeAuth>;
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    );
    auth = makeAuth();
    service = new UsersService(prisma as unknown as PrismaService, auth as unknown as AuthService);
  });

  describe('list', () => {
    it('trả về items đã map + phân trang, không lộ passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([userRow()]);
      prisma.user.count.mockResolvedValue(1);
      const res = await service.list({ page: 1, pageSize: 20 });
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
        service.create({ email: 'a@b.c', password: 'password1', fullName: 'A' }, ACTOR),
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
      await expect(service.assignRole('u1', 'ghost', null, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('idempotent: không tạo trùng nếu đã có', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' }); // ensureExists
      prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.user.findUnique.mockResolvedValueOnce(userRow()); // findOne cuối
      await service.assignRole('u1', 'student', null, ACTOR);
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('uỷ quyền cho AuthService.setPassword với action user.password_reset', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      auth.setPassword.mockResolvedValue({ revokedSessions: 3 });

      const res = await service.resetPassword('u1', 'matkhaumoi123', ACTOR);

      expect(res).toEqual({ revokedSessions: 3 });
      expect(auth.setPassword).toHaveBeenCalledWith({
        userId: 'u1',
        newPassword: 'matkhaumoi123',
        actorId: 'admin-1',
        action: 'user.password_reset',
        ip: '203.0.113.7',
      });
    });

    it('user không tồn tại -> NotFound và KHÔNG đụng tới mật khẩu', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('missing', 'matkhaumoi123', ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(auth.setPassword).not.toHaveBeenCalled();
    });
  });

  describe('list — lọc ở server', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
    });

    const whereOf = (mock: jest.Mock): Record<string, unknown> =>
      (mock.mock.calls[0][0] as { where: Record<string, unknown> }).where;

    it('search khớp email HOẶC họ tên, không phân biệt hoa thường', async () => {
      await service.list({ page: 1, pageSize: 20, search: '  Minh ' });
      expect(whereOf(prisma.user.findMany)).toEqual({
        OR: [
          { email: { contains: 'Minh', mode: 'insensitive' } },
          { fullName: { contains: 'Minh', mode: 'insensitive' } },
        ],
      });
    });

    it('count dùng CÙNG bộ lọc với findMany (nếu không, số trang sẽ sai)', async () => {
      await service.list({ page: 2, pageSize: 10, status: 'suspended', roleKey: 'student' });
      expect(whereOf(prisma.user.count)).toEqual(whereOf(prisma.user.findMany));
    });

    it('lọc theo role dịch sang quan hệ roles.some', async () => {
      await service.list({ page: 1, pageSize: 20, roleKey: 'instructor' });
      expect(whereOf(prisma.user.findMany)).toEqual({
        roles: { some: { role: { key: 'instructor' } } },
      });
    });

    it('search rỗng/khoảng trắng không sinh điều kiện thừa', async () => {
      await service.list({ page: 1, pageSize: 20, search: '   ' });
      expect(whereOf(prisma.user.findMany)).toEqual({});
    });
  });

  describe('AuditLog (INVARIANT #6)', () => {
    it('create ghi audit trong cùng transaction interactive', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue(userRow());

      await service.create({ email: 'a@b.c', password: 'password1', fullName: 'A' }, ACTOR);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'admin-1',
            action: 'user.create',
            entity: 'User',
            entityId: 'u1',
            ip: '203.0.113.7',
          }),
        }),
      );
    });

    it('create KHÔNG ghi mật khẩu hay email vào meta audit (INVARIANT #5)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([]);
      prisma.user.create.mockResolvedValue(userRow());

      await service.create({ email: 'a@b.c', password: 'password1', fullName: 'A' }, ACTOR);

      const audit = JSON.stringify(prisma.auditLog.create.mock.calls[0][0]);
      expect(audit).not.toContain('password1');
      expect(audit).not.toContain('a@b.c');
    });

    it('update ghi trạng thái trước và sau khi khoá tài khoản', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ status: 'active' });
      prisma.user.update.mockResolvedValue(userRow({ status: 'suspended' }));

      await service.update('u1', { status: 'suspended' }, ACTOR);

      const data = prisma.auditLog.create.mock.calls[0][0].data as {
        action: string;
        metaJson: { statusFrom: string; statusTo: string };
      };
      expect(data.action).toBe('user.update');
      expect(data.metaJson).toMatchObject({ statusFrom: 'active', statusTo: 'suspended' });
    });

    it('update trên user không tồn tại -> 404, KHÔNG ghi audit', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { status: 'active' }, ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('assignRole ghi audit cùng transaction với userRole.create', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValueOnce(userRow());

      await service.assignRole('u1', 'student', 'c1', ACTOR);

      const ops = prisma.$transaction.mock.calls[0][0] as unknown[];
      expect(ops).toHaveLength(2);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'role.assign',
            entityId: 'u1',
            metaJson: { roleKey: 'student', classId: 'c1' },
          }),
        }),
      );
    });

    it('assignRole lần hai (đã có role) KHÔNG ghi audit thừa', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.user.findUnique.mockResolvedValueOnce(userRow());

      await service.assignRole('u1', 'student', null, ACTOR);

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('revokeRole ghi audit role.revoke', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.user.findUnique.mockResolvedValueOnce(userRow());

      await service.revokeRole('u1', 'student', null, ACTOR);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'role.revoke' }) }),
      );
    });

    it('revokeRole khi user chưa có role đó -> không xoá, không audit', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
      prisma.role.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValueOnce(userRow());

      await service.revokeRole('u1', 'student', null, ACTOR);

      expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});