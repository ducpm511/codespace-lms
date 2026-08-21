import { TeachService } from './teach.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    class: { findMany: jest.fn() },
    classMember: { findMany: jest.fn() },
    lessonGate: { findMany: jest.fn() },
    classCourse: { findMany: jest.fn() },
    submission: { groupBy: jest.fn() },
    lessonProgress: { groupBy: jest.fn() },
  };
}

describe('TeachService.getOverview', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: TeachService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TeachService(prisma as unknown as PrismaService);
  });

  /** Hai lớp: c1 (2 học viên × 2 bài mở), c2 (1 học viên × 1 bài mở) -> mẫu số 5. */
  const twoClasses = (): void => {
    prisma.class.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    prisma.classMember.findMany.mockResolvedValue([
      { classId: 'c1', userId: 'u1' },
      { classId: 'c1', userId: 'u2' },
      { classId: 'c2', userId: 'u1' },
    ]);
    prisma.lessonGate.findMany.mockResolvedValue([
      { classId: 'c1', lessonId: 'l1' },
      { classId: 'c1', lessonId: 'l2' },
      { classId: 'c2', lessonId: 'l3' },
    ]);
    prisma.classCourse.findMany.mockResolvedValue([
      { courseId: 'course-a' },
      { courseId: 'course-a' },
      { courseId: 'course-b' },
    ]);
    prisma.submission.groupBy.mockResolvedValue([
      { classId: 'c1', _count: { _all: 3 } },
      { classId: 'c2', _count: { _all: 1 } },
    ]);
    prisma.lessonProgress.groupBy.mockResolvedValue([
      { classId: 'c1', _count: { _all: 2 } },
      { classId: 'c2', _count: { _all: 1 } },
    ]);
  };

  it('không phụ trách lớp nào -> tất cả bằng 0, KHÔNG truy vấn thêm', async () => {
    prisma.class.findMany.mockResolvedValue([]);

    const res = await service.getOverview('teacher-1');

    expect(res).toEqual({
      classCount: 0,
      studentCount: 0,
      courseCount: 0,
      avgProgress: 0,
      pendingGradingCount: 0,
      classes: [],
    });
    expect(prisma.classMember.findMany).not.toHaveBeenCalled();
    expect(prisma.submission.groupBy).not.toHaveBeenCalled();
  });

  it('gộp đủ số liệu tổng trong một lượt', async () => {
    twoClasses();

    const res = await service.getOverview('teacher-1');

    expect(res).toMatchObject({
      classCount: 2,
      studentCount: 2, // u1 học cả hai lớp nhưng chỉ tính 1 người
      courseCount: 2, // course-a gán cho 2 lớp nhưng chỉ tính 1 khóa
      avgProgress: 60, // (2 + 1) / (2*2 + 1*1) = 60%
      pendingGradingCount: 4,
    });
  });

  it('trả kèm số liệu từng lớp cho sidebar tab Lớp học', async () => {
    twoClasses();

    const res = await service.getOverview('teacher-1');

    expect(res.classes).toEqual([
      { classId: 'c1', studentCount: 2, progress: 50, pendingGradingCount: 3 },
      { classId: 'c2', studentCount: 1, progress: 100, pendingGradingCount: 1 },
    ]);
  });

  it('tiến độ chung tính theo TỔNG lượt hoàn thành, không phải trung bình các tỉ lệ', async () => {
    // Lớp lớn 10 em × 1 bài, hoàn thành 1 (10%); lớp nhỏ 1 em × 1 bài, hoàn thành 1 (100%).
    // Trung bình các tỉ lệ sẽ ra 55% — sai; đúng phải là 2/11 ≈ 18%.
    prisma.class.findMany.mockResolvedValue([{ id: 'big' }, { id: 'small' }]);
    prisma.classMember.findMany.mockResolvedValue([
      ...Array.from({ length: 10 }, (_, i) => ({ classId: 'big', userId: `s${i}` })),
      { classId: 'small', userId: 'x' },
    ]);
    prisma.lessonGate.findMany.mockResolvedValue([
      { classId: 'big', lessonId: 'l1' },
      { classId: 'small', lessonId: 'l2' },
    ]);
    prisma.classCourse.findMany.mockResolvedValue([]);
    prisma.submission.groupBy.mockResolvedValue([]);
    prisma.lessonProgress.groupBy.mockResolvedValue([
      { classId: 'big', _count: { _all: 1 } },
      { classId: 'small', _count: { _all: 1 } },
    ]);

    const res = await service.getOverview('teacher-1');

    expect(res.avgProgress).toBe(18);
  });

  it('chỉ tính lớp người dùng phụ trách — tự tạo hoặc là instructor/ta', async () => {
    prisma.class.findMany.mockResolvedValue([]);
    await service.getOverview('teacher-1');

    expect(prisma.class.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { createdById: 'teacher-1' },
          {
            members: {
              some: {
                userId: 'teacher-1',
                status: 'active',
                roleInClass: { in: ['instructor', 'ta'] },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
  });

  it('đếm hoàn thành bằng MỘT query, mỗi lớp một nhánh OR đúng học viên + đúng bài mở gate', async () => {
    twoClasses();
    await service.getOverview('teacher-1');

    expect(prisma.lessonProgress.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.lessonProgress.groupBy).toHaveBeenCalledWith({
      by: ['classId'],
      _count: { _all: true },
      where: {
        OR: [
          {
            classId: 'c1',
            status: 'completed',
            userId: { in: ['u1', 'u2'] },
            lessonId: { in: ['l1', 'l2'] },
          },
          {
            classId: 'c2',
            status: 'completed',
            userId: { in: ['u1'] },
            lessonId: { in: ['l3'] },
          },
        ],
      },
    });
  });

  it('số truy vấn KHÔNG tăng theo số lớp (đó là lý do endpoint này tồn tại)', async () => {
    prisma.class.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ id: `c${i}` })),
    );
    prisma.classMember.findMany.mockResolvedValue([]);
    prisma.lessonGate.findMany.mockResolvedValue([]);
    prisma.classCourse.findMany.mockResolvedValue([]);
    prisma.submission.groupBy.mockResolvedValue([]);

    await service.getOverview('teacher-1');

    const calls =
      prisma.class.findMany.mock.calls.length +
      prisma.classMember.findMany.mock.calls.length +
      prisma.lessonGate.findMany.mock.calls.length +
      prisma.classCourse.findMany.mock.calls.length +
      prisma.submission.groupBy.mock.calls.length +
      prisma.lessonProgress.groupBy.mock.calls.length;
    expect(calls).toBe(5);
  });

  it('lớp chưa mở bài nào -> tiến độ 0, không chia cho 0', async () => {
    prisma.class.findMany.mockResolvedValue([{ id: 'c1' }]);
    prisma.classMember.findMany.mockResolvedValue([{ classId: 'c1', userId: 'u1' }]);
    prisma.lessonGate.findMany.mockResolvedValue([]);
    prisma.classCourse.findMany.mockResolvedValue([]);
    prisma.submission.groupBy.mockResolvedValue([]);

    const res = await service.getOverview('teacher-1');

    expect(res.avgProgress).toBe(0);
    expect(prisma.lessonProgress.groupBy).not.toHaveBeenCalled();
  });

  it('lớp chưa có học viên -> tiến độ 0 thay vì NaN', async () => {
    prisma.class.findMany.mockResolvedValue([{ id: 'c1' }]);
    prisma.classMember.findMany.mockResolvedValue([]);
    prisma.lessonGate.findMany.mockResolvedValue([{ classId: 'c1', lessonId: 'l1' }]);
    prisma.classCourse.findMany.mockResolvedValue([]);
    prisma.submission.groupBy.mockResolvedValue([]);

    const res = await service.getOverview('teacher-1');

    expect(res.avgProgress).toBe(0);
    expect(res.classCount).toBe(1);
  });
});
