import { Injectable } from '@nestjs/common';
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

  /** Nạp toàn bộ role→permission của user, tách theo phạm vi global vs từng lớp. */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
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
}
