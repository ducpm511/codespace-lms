import { Injectable } from '@nestjs/common';
import type { TeachClassStatDto, TeachOverviewDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

const EMPTY_OVERVIEW: TeachOverviewDto = {
  classCount: 0,
  studentCount: 0,
  courseCount: 0,
  avgProgress: 0,
  pendingGradingCount: 0,
  classes: [],
};

@Injectable()
export class TeachService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Số liệu khu Giảng dạy trong MỘT lượt: tổng cho hero + tóm tắt từng lớp cho sidebar tab Lớp học.
   *
   * Trước đây FE gọi `/classes/:id/report` cho từng lớp — 10 lớp là 10 truy vấn tổng hợp mỗi lần
   * mở tab, và vẫn không có số "chờ chấm". Ở đây tổng số truy vấn là hằng số (6), không phụ
   * thuộc số lớp: đúng thứ VPS 2 GB cần.
   *
   * Phạm vi: ĐÚNG BẰNG tập lớp mà `GET /classes` trả về (mọi lớp, gác bằng quyền `class.read`),
   * vì sidebar tab Lớp học lấy từ đó. Thu hẹp riêng endpoint này xuống "lớp tôi dạy" sẽ khiến
   * hero báo 0 trong khi sidebar liệt kê 10 lớp — hai con số của cùng một màn hình phải khớp nhau.
   * Việc thu hẹp phạm vi khu Giảng dạy là thay đổi cho CẢ `GET /classes` lẫn sidebar và hero
   * cùng lúc — đã ghi thành task riêng trong ACTIVE_TASKS.
   *
   * Tham số `userId` giữ lại để bước thu hẹp đó không phải đổi chữ ký ở controller.
   */
  async getOverview(_userId: string): Promise<TeachOverviewDto> {
    const classes = await this.prisma.class.findMany({ select: { id: true } });
    const classIds = classes.map((c) => c.id);
    if (classIds.length === 0) {
      return EMPTY_OVERVIEW;
    }

    const [students, gates, assignedCourses, pendingByClass] = await Promise.all([
      this.prisma.classMember.findMany({
        where: { classId: { in: classIds }, status: 'active', roleInClass: 'student' },
        select: { classId: true, userId: true },
      }),
      this.prisma.lessonGate.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: { classId: true, lessonId: true },
      }),
      this.prisma.classCourse.findMany({
        where: { classId: { in: classIds } },
        select: { courseId: true },
      }),
      this.prisma.submission.groupBy({
        by: ['classId'],
        where: { classId: { in: classIds }, status: 'submitted' },
        _count: { _all: true },
      }),
    ]);

    const studentsByClass = groupBy(students, (s) => s.classId, (s) => s.userId);
    const gatesByClass = groupBy(gates, (g) => g.classId, (g) => g.lessonId);
    const pendingCount = new Map(pendingByClass.map((row) => [row.classId, row._count._all]));
    const completedByClass = await this.countCompletedPerClass(
      classIds,
      studentsByClass,
      gatesByClass,
    );

    const perClass: TeachClassStatDto[] = classIds.map((classId) => {
      const studentCount = studentsByClass.get(classId)?.length ?? 0;
      const gateCount = gatesByClass.get(classId)?.length ?? 0;
      // Mẫu số = học viên × bài đã mở gate — cùng định nghĩa với
      // ClassesService.getClassReport để hai màn hình không nói hai con số khác nhau.
      const denominator = studentCount * gateCount;
      const completed = completedByClass.get(classId) ?? 0;
      return {
        classId,
        studentCount,
        progress: denominator === 0 ? 0 : Math.round((completed / denominator) * 100),
        pendingGradingCount: pendingCount.get(classId) ?? 0,
      };
    });

    const totalDenominator = classIds.reduce(
      (sum, id) =>
        sum + (studentsByClass.get(id)?.length ?? 0) * (gatesByClass.get(id)?.length ?? 0),
      0,
    );
    const totalCompleted = [...completedByClass.values()].reduce((sum, n) => sum + n, 0);

    return {
      classCount: classIds.length,
      studentCount: new Set(students.map((s) => s.userId)).size,
      courseCount: new Set(assignedCourses.map((c) => c.courseId)).size,
      // Trung bình toàn khu tính trên TỔNG lượt hoàn thành, không phải trung bình của các tỉ lệ:
      // lớp 30 em và lớp 3 em không thể có cùng trọng số.
      avgProgress: totalDenominator === 0 ? 0 : Math.round((totalCompleted / totalDenominator) * 100),
      pendingGradingCount: perClass.reduce((sum, c) => sum + c.pendingGradingCount, 0),
      classes: perClass,
    };
  }

  /**
   * Đếm lượt hoàn thành theo lớp trong MỘT query: mỗi lớp là một nhánh OR ràng buộc đúng học viên
   * và đúng bài đã mở gate của lớp đó. Đếm thô theo classId sẽ tính cả bài đã đóng gate lại và cả
   * thành viên không phải học viên, khiến tiến độ vọt quá 100%.
   */
  private async countCompletedPerClass(
    classIds: string[],
    studentsByClass: Map<string, string[]>,
    gatesByClass: Map<string, string[]>,
  ): Promise<Map<string, number>> {
    const branches = classIds
      .map((classId) => ({
        classId,
        status: 'completed' as const,
        userId: { in: studentsByClass.get(classId) ?? [] },
        lessonId: { in: gatesByClass.get(classId) ?? [] },
      }))
      .filter((b) => b.userId.in.length > 0 && b.lessonId.in.length > 0);

    if (branches.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.lessonProgress.groupBy({
      by: ['classId'],
      where: { OR: branches },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.classId, row._count._all]));
  }
}

function groupBy<T, V>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => V): Map<string, V[]> {
  const map = new Map<string, V[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(valueOf(row));
    else map.set(key, [valueOf(row)]);
  }
  return map;
}
