import { UnauthorizedException } from '@nestjs/common';
import { AuthService, parseDurationMs } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';

type PrismaMock = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  refreshToken: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): PrismaMock {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
});
