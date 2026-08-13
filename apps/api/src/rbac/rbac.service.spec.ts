import { RbacService } from './rbac.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma(userRoles: unknown[]): PrismaService {
  return {
    userRole: { findMany: jest.fn().mockResolvedValue(userRoles) },
  } as unknown as PrismaService;
}

function rp(key: string) {
  return { permission: { key } };
}

describe('RbacService', () => {
  describe('getEffectivePermissions', () => {
    it('tách quyền global vs theo lớp', async () => {
      const prisma = makePrisma([
        { classId: null, role: { permissions: [rp('course.create'), rp('user.read')] } },
        { classId: 'class-1', role: { permissions: [rp('grade.write')] } },
        { classId: 'class-1', role: { permissions: [rp('grade.read')] } },
        { classId: 'class-2', role: { permissions: [rp('grade.write')] } },
      ]);
      const service = new RbacService(prisma);
      const eff = await service.getEffectivePermissions('u1');

      expect([...eff.global].sort()).toEqual(['course.create', 'user.read']);
      expect([...(eff.byClass.get('class-1') ?? [])].sort()).toEqual(['grade.read', 'grade.write']);
      expect([...(eff.byClass.get('class-2') ?? [])]).toEqual(['grade.write']);
    });
  });

  describe('hasPermission', () => {
    const service = new RbacService(makePrisma([]));
    const eff = {
      global: new Set(['course.create']),
      byClass: new Map([['class-1', new Set(['grade.write'])]]),
    };

    it('quyền global đúng ở mọi nơi', () => {
      expect(service.hasPermission(eff, 'course.create')).toBe(true);
      expect(service.hasPermission(eff, 'course.create', 'class-9')).toBe(true);
    });

    it('quyền theo lớp chỉ đúng khi classId khớp', () => {
      expect(service.hasPermission(eff, 'grade.write', 'class-1')).toBe(true);
      expect(service.hasPermission(eff, 'grade.write', 'class-2')).toBe(false);
      expect(service.hasPermission(eff, 'grade.write')).toBe(false); // thiếu ngữ cảnh lớp
    });

    it('không có quyền → false', () => {
      expect(service.hasPermission(eff, 'user.delete', 'class-1')).toBe(false);
    });
  });
});
