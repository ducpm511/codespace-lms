import { Injectable } from '@nestjs/common';
import type { AdminOverviewDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

const TEACHER_ROLES = ['instructor', 'teaching_assistant'];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dãy số liệu ở đầu khu Quản trị (T10.5).
   *
   * Ba truy vấn cố định, không phụ thuộc số bản ghi — cùng lý do với `GET /teach/overview`:
   * nạp hết user về rồi đếm ở client là cách chắc chắn làm nghẹt máy 2 GB khi trường lớn dần.
   *
   * Tài khoản `suspended` bị loại: một giáo viên đã khoá thì không còn dạy, đếm vào là nói dối.
   * Một người giữ cả `instructor` lẫn `teaching_assistant` chỉ được đếm MỘT lần.
   */
  async getOverview(): Promise<AdminOverviewDto> {
    const [roleRows, activeClassCount, publishedCourseCount] = await Promise.all([
      this.prisma.userRole.findMany({
        where: {
          role: { key: { in: [...TEACHER_ROLES, 'student'] } },
          user: { status: { not: 'suspended' } },
        },
        select: { userId: true, role: { select: { key: true } } },
      }),
      this.prisma.class.count({ where: { status: 'active' } }),
      this.prisma.course.count({ where: { status: 'published' } }),
    ]);

    const teachers = new Set<string>();
    const students = new Set<string>();
    for (const row of roleRows) {
      if (TEACHER_ROLES.includes(row.role.key)) {
        teachers.add(row.userId);
      } else {
        students.add(row.userId);
      }
    }

    return {
      teacherCount: teachers.size,
      studentCount: students.size,
      activeClassCount,
      publishedCourseCount,
    };
  }
}
