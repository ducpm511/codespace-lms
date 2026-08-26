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
   * Bốn truy vấn cố định, không phụ thuộc số bản ghi — cùng lý do với `GET /teach/overview`:
   * nạp hết user về rồi đếm ở client là cách chắc chắn làm nghẹt máy 2 GB khi trường lớn dần.
   *
   * **Đếm theo role LẪN theo ghi danh lớp.** Chỉ đếm theo role thì con số nói dối: trên DB dev có
   * 12 học viên đang học trong lớp nhưng chỉ 2 tài khoản mang role `student` — 16 tài khoản không
   * mang role nào (được tạo rồi thêm thẳng vào lớp). Một người vừa là giáo viên vừa ghi danh học
   * ở lớp khác chỉ được tính là GIÁO VIÊN, không đếm hai lần.
   *
   * Tài khoản `suspended` bị loại: một giáo viên đã khoá thì không còn dạy, đếm vào là nói dối.
   */
  async getOverview(): Promise<AdminOverviewDto> {
    const activeUser = { user: { status: { not: 'suspended' as const } } };

    const [roleRows, memberRows, activeClassCount, publishedCourseCount] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { role: { key: { in: [...TEACHER_ROLES, 'student'] } }, ...activeUser },
        select: { userId: true, role: { select: { key: true } } },
      }),
      this.prisma.classMember.findMany({
        where: { status: 'active', ...activeUser },
        select: { userId: true, roleInClass: true },
      }),
      this.prisma.class.count({ where: { status: 'active' } }),
      this.prisma.course.count({ where: { status: 'published' } }),
    ]);

    const teachers = new Set<string>();
    const students = new Set<string>();

    for (const row of roleRows) {
      (TEACHER_ROLES.includes(row.role.key) ? teachers : students).add(row.userId);
    }
    for (const row of memberRows) {
      (row.roleInClass === 'student' ? students : teachers).add(row.userId);
    }
    // Dạy là vai trò "mạnh" hơn: GV có ghi danh học ở lớp khác vẫn đếm vào cột giáo viên.
    for (const id of teachers) {
      students.delete(id);
    }

    return {
      teacherCount: teachers.size,
      studentCount: students.size,
      activeClassCount,
      publishedCourseCount,
    };
  }
}
