import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuthService, parseDurationMs } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';

type PrismaMock = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  refreshToken: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): PrismaMock {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') } as unknown as JwtService;
const config = {
  get: jest.fn().mockReturnValue('15m'),
  getOrThrow: jest.fn().mockReturnValue('secret'),
} as unknown as ConfigService;

describe('parseDurationMs', () => {
  it.each([
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
    ['45s', 45_000],
  ])('parse %s', (ttl, ms) => {
    expect(parseDurationMs(ttl)).toBe(ms);
  });

  it('ném lỗi khi TTL sai định dạng', () => {
    expect(() => parseDurationMs('abc')).toThrow();
  });
});

describe('AuthService', () => {
  let prisma: PrismaMock;
  let service: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as unknown as PrismaService, jwt, config);
  });

  describe('login', () => {
    it('ném 401 khi email không tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('x@y.z', 'pw', {})).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('ném 401 khi user bị suspended', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'suspended', passwordHash: 'h' });
      await expect(service.login('x@y.z', 'pw', {})).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('ném 401 khi thiếu token', async () => {
      await expect(service.refresh(undefined, {})).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('ném 401 khi token đã bị thu hồi', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.refresh('raw', {})).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('buildAuthUser', () => {
    it('gộp và khử trùng permission từ nhiều role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        fullName: 'A',
        avatarUrl: null,
        status: 'active',
        roles: [
          { role: { key: 'instructor', permissions: [{ permission: { key: 'course.create' } }, { permission: { key: 'grade.write' } }] } },
          { role: { key: 'student', permissions: [{ permission: { key: 'grade.write' } }] } },
        ],
      });
      const user = await service.buildAuthUser('u1');
      expect(user.roles).toEqual(['instructor', 'student']);
      expect(user.permissions.sort()).toEqual(['course.create', 'grade.write']);
    });

    it('ném 401 khi user không tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.buildAuthUser('nope')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('setPassword', () => {
    /** Prisma nhận MẢNG operation -> chứng minh cả 3 việc nằm trong CÙNG một transaction. */
    const captureTx = (prisma: PrismaMock): unknown[] => {
      const calls = prisma.$transaction.mock.calls as unknown[][];
      expect(calls).toHaveLength(1);
      return calls[0][0] as unknown[];
    };

    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([{ id: 'u1' }, { count: 2 }, { id: 'log1' }]);
    });

    it('đổi hash + thu hồi hết refresh token + ghi audit trong CÙNG transaction (INVARIANT #6)', async () => {
      const res = await service.setPassword({
        userId: 'u1',
        newPassword: 'matkhaumoi123',
        actorId: 'u1',
        action: 'user.password_change',
      });

      expect(res).toEqual({ revokedSessions: 2 });
      expect(captureTx(prisma)).toHaveLength(3);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'u1',
            action: 'user.password_change',
            entity: 'User',
            entityId: 'u1',
          }),
        }),
      );
    });

    it('lưu hash bcrypt, KHÔNG lưu mật khẩu thô', async () => {
      await service.setPassword({
        userId: 'u1',
        newPassword: 'matkhaumoi123',
        actorId: 'u1',
        action: 'user.password_change',
      });
      const data = prisma.user.update.mock.calls[0][0].data as { passwordHash: string };
      expect(data.passwordHash).not.toBe('matkhaumoi123');
      expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('KHÔNG ghi mật khẩu vào audit (INVARIANT #5)', async () => {
      await service.setPassword({
        userId: 'u1',
        newPassword: 'matkhaumoi123',
        actorId: 'admin-1',
        action: 'user.password_reset',
        ip: '203.0.113.7',
      });
      const audit = JSON.stringify(prisma.auditLog.create.mock.calls[0][0]);
      expect(audit).not.toContain('matkhaumoi123');
      expect(audit).toContain('203.0.113.7');
    });

    it('admin đặt lại thì audit đánh dấu selfService=false', async () => {
      await service.setPassword({
        userId: 'u1',
        newPassword: 'matkhaumoi123',
        actorId: 'admin-1',
        action: 'user.password_reset',
      });
      const data = prisma.auditLog.create.mock.calls[0][0].data as {
        metaJson: { selfService: boolean };
      };
      expect(data.metaJson.selfService).toBe(false);
    });
  });

  describe('changePassword', () => {
    const withUser = async (password: string): Promise<void> => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: await hash(password, 4) });
      prisma.$transaction.mockResolvedValue([{ id: 'u1' }, { count: 1 }, { id: 'log1' }]);
    };

    it('sai mật khẩu hiện tại -> 401 và KHÔNG đổi gì', async () => {
      await withUser('matkhaucu123');
      await expect(
        service.changePassword('u1', 'doan-sai', 'matkhaumoi123', {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('user không tồn tại -> 401', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('u1', 'matkhaucu123', 'matkhaumoi123', {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('mật khẩu mới trùng mật khẩu cũ -> 400', async () => {
      await withUser('matkhaucu123');
      await expect(
        service.changePassword('u1', 'matkhaucu123', 'matkhaucu123', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('đúng mật khẩu hiện tại -> đổi và trả số phiên bị thu hồi', async () => {
      await withUser('matkhaucu123');
      const res = await service.changePassword('u1', 'matkhaucu123', 'matkhaumoi123', {
        ip: '198.51.100.4',
      });
      expect(res).toEqual({ revokedSessions: 1 });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'user.password_change' }),
        }),
      );
    });
  });
});