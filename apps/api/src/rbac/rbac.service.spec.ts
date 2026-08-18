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

    // Hồi quy: nếu userId rỗng lọt xuống Prisma, `where: { userId: undefined }` bị coi là "không lọc"
    // → trả MỌI user_role → hợp nhất quyền của mọi role ≈ super_admin (leo thang đặc quyền).
    it.each([undefined, null, ''])('KHÔNG trả quyền nào khi userId rỗng (%p)', async (bad) => {
      const prisma = makePrisma([
        { classId: null, role: { permissions: [rp('certificate.revoke'), rp('user.delete')] } },
        { classId: 'class-1', role: { permissions: [rp('grade.write')] } },
      ]);
      const service = new RbacService(prisma);

      const eff = await service.getEffectivePermissions(bad as unknown as string);

      expect(eff.global.size).toBe(0);
      expect(eff.byClass.size).toBe(0);
      expect(service.hasPermission(eff, 'certificate.revoke')).toBe(false);
      expect(service.hasPermission(eff, 'grade.write', 'class-1')).toBe(false);
      // và không được chạm DB với filter rỗng
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
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
