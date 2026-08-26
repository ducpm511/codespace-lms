import { AdminService } from './admin.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
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

  it('loại tài khoản đã khoá — GV bị khoá không còn dạy', async () => {
    await service.getOverview();
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { status: { not: 'suspended' } } }),
      }),
    );
  });
});
