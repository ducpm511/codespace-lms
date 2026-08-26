import { AdminService } from './admin.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    classMember: { findMany: jest.fn().mockResolvedValue([]) },
    class: { count: jest.fn().mockResolvedValue(0) },
    course: { count: jest.fn().mockResolvedValue(0) },
  };
}

describe('AdminService.getOverview', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AdminService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AdminService(prisma as unknown as PrismaService);
  });

  it('đếm GV và học viên theo vai trò, lớp active, khóa published', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { userId: 'u1', role: { key: 'instructor' } },
      { userId: 'u2', role: { key: 'teaching_assistant' } },
      { userId: 'u3', role: { key: 'student' } },
      { userId: 'u4', role: { key: 'student' } },
    ]);
    prisma.class.count.mockResolvedValue(3);
    prisma.course.count.mockResolvedValue(5);

    await expect(service.getOverview()).resolves.toEqual({
      teacherCount: 2,
      studentCount: 2,
      activeClassCount: 3,
      publishedCourseCount: 5,
    });
    expect(prisma.class.count).toHaveBeenCalledWith({ where: { status: 'active' } });
    expect(prisma.course.count).toHaveBeenCalledWith({ where: { status: 'published' } });
  });

  it('người giữ cả instructor lẫn TA chỉ đếm MỘT lần', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { userId: 'u1', role: { key: 'instructor' } },
      { userId: 'u1', role: { key: 'teaching_assistant' } },
    ]);

    const res = await service.getOverview();
    expect(res.teacherCount).toBe(1);
  });

  it('đếm cả học viên KHÔNG mang role, chỉ ghi danh vào lớp', async () => {
    // Dữ liệu thật: tài khoản được tạo rồi thêm thẳng vào lớp, không ai gán role `student`.
    prisma.userRole.findMany.mockResolvedValue([]);
    prisma.classMember.findMany.mockResolvedValue([
      { userId: 'kid-1', roleInClass: 'student' },
      { userId: 'kid-2', roleInClass: 'student' },
      { userId: 'kid-2', roleInClass: 'student' }, // học 2 lớp -> vẫn 1 người
    ]);

    const res = await service.getOverview();
    expect(res.studentCount).toBe(2);
  });

  it('instructor/ta là thành viên lớp cũng tính vào cột giáo viên', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);
    prisma.classMember.findMany.mockResolvedValue([
      { userId: 'gv-1', roleInClass: 'instructor' },
      { userId: 'ta-1', roleInClass: 'ta' },
      { userId: 'kid-1', roleInClass: 'student' },
    ]);

    const res = await service.getOverview();
    expect(res).toMatchObject({ teacherCount: 2, studentCount: 1 });
  });

  it('GV có ghi danh học ở lớp khác chỉ đếm vào cột giáo viên', async () => {
    prisma.userRole.findMany.mockResolvedValue([{ userId: 'gv-1', role: { key: 'instructor' } }]);
    prisma.classMember.findMany.mockResolvedValue([{ userId: 'gv-1', roleInClass: 'student' }]);

    const res = await service.getOverview();
    expect(res).toMatchObject({ teacherCount: 1, studentCount: 0 });
  });

  it('loại tài khoản đã khoá — GV bị khoá không còn dạy', async () => {
    await service.getOverview();
    const notSuspended = { user: { status: { not: 'suspended' } } };
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(notSuspended) }),
    );
    expect(prisma.classMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(notSuspended) }),
    );
  });
});
