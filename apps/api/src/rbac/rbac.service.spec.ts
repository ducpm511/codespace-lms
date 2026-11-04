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

  describe('isClassStaff', () => {
    const CLASS = 'class-1';
    const NEED = ['quiz.result.read', 'quiz.read'];
    // Giống seed: student có quiz.result.read nhưng KHÔNG có quiz.read; instructor không có class.delete.
    const STUDENT = ['quiz.result.read'];
    const INSTRUCTOR = ['quiz.read', 'quiz.result.read'];
    const ADMIN = ['quiz.read', 'quiz.result.read', 'class.delete'];

    function setup(
      roles: { classId: string | null; keys: string[] }[],
      cls: { createdById: string; members: { status: string; roleInClass: string }[] } | null = {
        createdById: 'someone-else',
        members: [],
      },
    ) {
      const classFindUnique = jest.fn().mockResolvedValue(cls);
      const prisma = {
        userRole: {
          findMany: jest.fn().mockResolvedValue(
            roles.map((r) => ({ classId: r.classId, role: { permissions: r.keys.map(rp) } })),
          ),
        },
        class: { findUnique: classFindUnique },
      } as unknown as PrismaService;
      return { service: new RbacService(prisma), classFindUnique };
    }
    const globalRole = (keys: string[]) => ({ classId: null, keys });

    it('học viên role global → false, kể cả khi đang học trong lớp', async () => {
      const { service, classFindUnique } = setup([globalRole(STUDENT)], {
        createdById: 'someone-else',
        members: [{ status: 'active', roleInClass: 'student' }],
      });
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(false);
      expect(classFindUnique).not.toHaveBeenCalled();
    });

    it('GV global của lớp khác → false', async () => {
      const { service } = setup([globalRole(INSTRUCTOR)]);
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(false);
    });

    it('người tạo lớp → true', async () => {
      const { service } = setup([globalRole(INSTRUCTOR)], { createdById: 'u', members: [] });
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(true);
    });

    it.each(['instructor', 'ta'])('%s đang hoạt động của lớp → true', async (roleInClass) => {
      const { service } = setup([globalRole(INSTRUCTOR)], {
        createdById: 'someone-else',
        members: [{ status: 'active', roleInClass }],
      });
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(true);
    });

    it('GV đã rời lớp → false', async () => {
      const { service } = setup([globalRole(INSTRUCTOR)], {
        createdById: 'someone-else',
        members: [{ status: 'removed', roleInClass: 'instructor' }],
      });
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(false);
    });

    it('GV global là HỌC VIÊN của lớp này → false', async () => {
      const { service } = setup([globalRole(INSTRUCTOR)], {
        createdById: 'someone-else',
        members: [{ status: 'active', roleInClass: 'student' }],
      });
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(false);
    });

    it('role gán riêng cho đúng lớp → true, không cần tra lớp', async () => {
      const { service, classFindUnique } = setup([{ classId: CLASS, keys: INSTRUCTOR }]);
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(true);
      expect(classFindUnique).not.toHaveBeenCalled();
    });

    it('role gán riêng cho lớp KHÁC → false', async () => {
      const { service } = setup([{ classId: 'class-2', keys: INSTRUCTOR }]);
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(false);
    });

    it('GV global mang thêm role student ở lớp này KHÔNG thành staff của lớp', async () => {
      const { service } = setup([globalRole(INSTRUCTOR), { classId: CLASS, keys: STUDENT }]);
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(false);
    });

    it('admin → true ở mọi lớp', async () => {
      const { service, classFindUnique } = setup([globalRole(ADMIN)]);
      await expect(service.isClassStaff('u', CLASS, NEED)).resolves.toBe(true);
      expect(classFindUnique).not.toHaveBeenCalled();
    });

    it('lớp đã xóa (classId null): chỉ admin', async () => {
      await expect(setup([globalRole(ADMIN)]).service.isClassStaff('u', null, NEED)).resolves.toBe(true);
      await expect(setup([globalRole(INSTRUCTOR)]).service.isClassStaff('u', null, NEED)).resolves.toBe(false);
    });

    it("mode 'any': một trong các quyền là đủ qua cổng staff", async () => {
      const { service } = setup([globalRole(['grade.write'])], { createdById: 'u', members: [] });
      await expect(service.isClassStaff('u', CLASS, ['submission.read', 'grade.write'], 'any')).resolves.toBe(true);
      await expect(service.isClassStaff('u', CLASS, ['submission.read', 'grade.write'])).resolves.toBe(false);
    });
  });
});
