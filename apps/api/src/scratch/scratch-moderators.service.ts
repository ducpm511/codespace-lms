import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@lms/database';
import { PERMISSIONS } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

/**
 * Ai kiểm duyệt BlockSpace của học viên nào (người dùng chốt 2026-10-07):
 * - người có quyền global `scratch.moderate` (admin, super_admin) → mọi học viên;
 * - GV của BẤT KỲ lớp nào học viên đang học: người TẠO lớp, hoặc thành viên đang hoạt động vai
 *   instructor/ta của lớp đó. Học viên học 2 lớp thì GV của lớp nào cũng duyệt được.
 * Học viên trong lớp = thành viên đang hoạt động vai `student`.
 */
@Injectable()
export class ScratchModeratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async isGlobalModerator(userId: string): Promise<boolean> {
    const eff = await this.rbac.getEffectivePermissions(userId);
    return this.rbac.hasPermission(eff, PERMISSIONS.SCRATCH_MODERATE);
  }

  /** Điều kiện "lớp mà `moderatorId` dạy". */
  private taughtBy(moderatorId: string): Prisma.ClassWhereInput {
    return {
      OR: [
        { createdById: moderatorId },
        { members: { some: { userId: moderatorId, status: 'active', roleInClass: { in: ['instructor', 'ta'] } } } },
      ],
    };
  }

  async canModerate(moderatorId: string, studentId: string): Promise<boolean> {
    if (moderatorId === studentId) return false; // không tự duyệt bài mình (kể cả admin)
    if (await this.isGlobalModerator(moderatorId)) return true;
    const membership = await this.prisma.classMember.findFirst({
      where: { userId: studentId, status: 'active', roleInClass: 'student', class: this.taughtBy(moderatorId) },
      select: { id: true },
    });
    return membership !== null;
  }

  async assertCanModerate(moderatorId: string, studentId: string): Promise<void> {
    if (!(await this.canModerate(moderatorId, studentId))) {
      throw new ForbiddenException('Bạn không phải giáo viên của học viên này');
    }
  }

  /**
   * Điều kiện lọc "người dùng thuộc phạm vi tôi kiểm duyệt" cho hàng chờ: moderator global = mọi người,
   * GV = học viên các lớp mình dạy. Luôn loại chính mình.
   */
  async studentScope(moderatorId: string): Promise<Prisma.UserWhereInput> {
    if (await this.isGlobalModerator(moderatorId)) return { id: { not: moderatorId } };
    return {
      id: { not: moderatorId },
      classMemberships: {
        some: { status: 'active', roleInClass: 'student', class: this.taughtBy(moderatorId) },
      },
    };
  }
}
