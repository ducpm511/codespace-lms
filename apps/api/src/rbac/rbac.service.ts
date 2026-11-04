import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Quyền hiệu lực của một user:
 * - `global`: cấp qua role gán KHÔNG kèm lớp (UserRole.classId = null) → áp mọi nơi.
 * - `byClass`: cấp qua role gán kèm lớp cụ thể → chỉ áp trong đúng lớp đó (scope).
 */
export interface EffectivePermissions {
  global: Set<string>;
  byClass: Map<string, Set<string>>;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nạp toàn bộ role→permission của user, tách theo phạm vi global vs từng lớp.
   *
   * PHÒNG THỦ CHIỀU SÂU: `userId` rỗng/undefined trả về quyền RỖNG. Nếu để rơi xuống Prisma,
   * `where: { userId: undefined }` bị hiểu là "không lọc" → trả MỌI user_role → hợp nhất quyền của
   * mọi role ≈ super_admin. Một chỗ gọi sai (vd đọc nhầm `currentUser.id` thay vì `.userId`)
   * KHÔNG được phép biến thành cấp quyền toàn hệ thống.
   */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    if (!userId) {
      return { global: new Set<string>(), byClass: new Map<string, Set<string>>() };
    }
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const global = new Set<string>();
    const byClass = new Map<string, Set<string>>();

    for (const ur of userRoles) {
      const keys = ur.role.permissions.map((rp) => rp.permission.key);
      if (ur.classId == null) {
        for (const k of keys) global.add(k);
      } else {
        const set = byClass.get(ur.classId) ?? new Set<string>();
        for (const k of keys) set.add(k);
        byClass.set(ur.classId, set);
      }
    }

    return { global, byClass };
  }

  /**
   * Có quyền `key` không? Đúng nếu có ở phạm vi global, HOẶC (khi request gắn với 1 lớp) có ở đúng lớp đó.
   * Quyền global luôn thắng; quyền theo lớp chỉ hiệu lực khi classId khớp.
   */
  hasPermission(eff: EffectivePermissions, key: string, classId?: string): boolean {
    if (eff.global.has(key)) return true;
    if (classId) return eff.byClass.get(classId)?.has(key) ?? false;
    return false;
  }

  /**
   * Người này có được đụng vào bài làm của học viên khác trong lớp không (đọc bài, chấm, cấp chứng chỉ).
   * `hasPermission` KHÔNG đủ để trả lời câu này, vì role `instructor` đang gán GLOBAL (nợ kỹ thuật đã biết):
   * GV bất kỳ có quyền ở mọi lớp. Vì vậy phải qua hai cổng (INVARIANT #3):
   *
   * 1. Có `permissions` trong phạm vi lớp. Cổng này tách staff khỏi học viên, nên `permissions` phải gồm
   *    ít nhất một quyền role `student` không có. Vd `quiz.result.read` học viên cũng có, phải kèm `quiz.read`.
   * 2. Thật sự phụ trách lớp: role gán riêng cho lớp này, hoặc người tạo lớp, hoặc instructor/TA đang
   *    hoạt động của lớp, hoặc admin. Admin nhận `class.delete` global; instructor không có.
   *
   * `classId` null = lớp đã bị xóa, không còn ai phụ trách nên chỉ admin qua được.
   */
  async isClassStaff(
    userId: string,
    classId: string | null,
    permissions: readonly string[],
    mode: 'all' | 'any' = 'all',
  ): Promise<boolean> {
    const matches = (has: (key: string) => boolean) =>
      mode === 'all' ? permissions.every(has) : permissions.some(has);

    const eff = await this.getEffectivePermissions(userId);
    if (!matches((key) => this.hasPermission(eff, key, classId ?? undefined))) return false;
    if (eff.global.has(PERMISSIONS.CLASS_DELETE)) return true;
    if (!classId) return false;

    // Role gán theo lớp phải tự đủ quyền. GV lớp khác mang thêm role `student` ở lớp này vẫn là học viên ở đây.
    const scoped = eff.byClass.get(classId);
    if (scoped && matches((key) => scoped.has(key))) return true;

    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        createdById: true,
        members: { where: { userId }, select: { status: true, roleInClass: true } },
      },
    });
    if (cls?.createdById === userId) return true;
    const member = cls?.members[0];
    return member?.status === 'active' && (member.roleInClass === 'instructor' || member.roleInClass === 'ta');
  }
}
