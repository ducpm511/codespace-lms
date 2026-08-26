import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import type { AuditLogDto } from '@lms/contracts';
import { auditChips, auditGroup, auditSentence, auditTime } from './adminUi';

/** t() giả: trả lại chính key (+ tham số) để khẳng định ĐÚNG key được chọn. */
const t = ((key: string, opts?: Record<string, unknown>) =>
  opts && 'code' in opts ? `${key}:${String(opts.code)}` : key) as unknown as TFunction;

function log(over: Partial<AuditLogDto> = {}): AuditLogDto {
  return {
    id: 'a1',
    actorId: 'u-actor',
    actorName: 'Cô Trang',
    action: 'user.create',
    entity: 'User',
    entityId: 'u-target',
    metaJson: null,
    createdAt: '2026-08-26T02:41:00.000Z',
    ...over,
  };
}

describe('auditSentence', () => {
  it('đổi action thô thành câu mô tả', () => {
    expect(auditSentence(log({ action: 'user.create' }), t)).toBe('admin.auditSay.userCreate');
    expect(auditSentence(log({ action: 'role.revoke' }), t)).toBe('admin.auditSay.roleRevoke');
  });

  it('action lạ hiện nguyên văn thay vì câu sai', () => {
    expect(auditSentence(log({ action: 'something.new' }), t)).toBe('something.new');
  });
});

describe('auditGroup', () => {
  it('gom hành động theo nhóm để tô màu', () => {
    expect(auditGroup('user.create')).toBe('create');
    expect(auditGroup('user.password_reset')).toBe('reset');
    expect(auditGroup('role.assign')).toBe('assign');
    expect(auditGroup('certificate.revoke')).toBe('delete');
    expect(auditGroup('gamification.award')).toBe('award');
  });

  it('không có nhóm login — đã chốt không ghi audit đăng nhập', () => {
    // Nếu sau này ai đó thêm `auth.login`, nó rơi vào nhóm mặc định chứ không có màu riêng.
    expect(auditGroup('auth.login')).toBe('update');
  });
});

describe('auditChips', () => {
  it('user.create: hiện vai trò và trạng thái ban đầu', () => {
    const chips = auditChips(
      log({ action: 'user.create', metaJson: { roleKeys: ['teaching_assistant'], status: 'invited' } }),
      t,
    );
    expect(chips).toEqual(['roles.teaching_assistant', 'userStatus.invited']);
  });

  it('user.update: chỉ hiện khi trạng thái thực sự đổi', () => {
    const changed = auditChips(
      log({ action: 'user.update', metaJson: { statusFrom: 'active', statusTo: 'suspended' } }),
      t,
    );
    expect(changed).toEqual(['userStatus.active → userStatus.suspended']);

    const unchanged = auditChips(
      log({ action: 'user.update', metaJson: { statusFrom: 'active', statusTo: 'active' } }),
      t,
    );
    expect(unchanged).toEqual([]);
  });

  it('role.assign: kèm dấu hiệu giới hạn theo lớp', () => {
    expect(
      auditChips(log({ action: 'role.assign', metaJson: { roleKey: 'instructor', classId: 'cl1' } }), t),
    ).toEqual(['roles.instructor', 'admin.auditScopedToClass']);

    expect(
      auditChips(log({ action: 'role.assign', metaJson: { roleKey: 'instructor', classId: null } }), t),
    ).toEqual(['roles.instructor']);
  });

  it('gamification.award: huy hiệu + XP', () => {
    expect(
      auditChips(
        log({
          action: 'gamification.award',
          metaJson: { classId: 'cl1', badgeCode: 'helping_hand', xpAmount: 50, hasNote: true },
        }),
        t,
      ),
    ).toEqual(['admin.auditBadge:helping_hand', '+50 XP']);
  });

  it('metaJson rỗng hoặc null không làm vỡ gì', () => {
    expect(auditChips(log({ metaJson: null }), t)).toEqual([]);
    expect(auditChips(log({ action: 'certificate.issue', metaJson: {} }), t)).toEqual([]);
  });
});

describe('auditTime', () => {
  // Mốc ngày theo giờ MÁY NGƯỜI XEM, nên dựng Date từ giờ địa phương để test không lệ thuộc TZ.
  const at = (y: number, m: number, d: number, h: number, min: number): Date =>
    new Date(y, m - 1, d, h, min, 0);

  it('hôm nay / hôm qua / ngày cũ', () => {
    const now = at(2026, 8, 26, 14, 0);
    expect(auditTime(at(2026, 8, 26, 9, 41).toISOString(), t, now)).toBe('admin.auditToday · 09:41');
    expect(auditTime(at(2026, 8, 25, 15, 2).toISOString(), t, now)).toBe('admin.auditYesterday · 15:02');
    expect(auditTime(at(2026, 8, 24, 9, 41).toISOString(), t, now)).toBe('24/08 · 09:41');
  });

  it('cùng ngày nhưng khác năm KHÔNG phải "hôm nay"', () => {
    const now = at(2026, 8, 26, 14, 0);
    expect(auditTime(at(2025, 8, 26, 9, 41).toISOString(), t, now)).toBe('26/08 · 09:41');
  });
});
