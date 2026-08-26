import type { TFunction } from 'i18next';
import type { AuditLogDto, UserStatusValue } from '@lms/contracts';

/* ═══════════════ Vai trò & trạng thái — chip có icon + màu ═══════════════ */

export interface Meta {
  icon: string;
  color: string;
}

/** Icon Phosphor **fill** + màu riêng cho từng vai trò (design handoff khu Quản trị). */
export const ROLE_META: Record<string, Meta> = {
  super_admin: { icon: 'ph-crown-simple', color: 'var(--cx-coral)' },
  admin: { icon: 'ph-shield-check', color: 'var(--cx-purple)' },
  instructor: { icon: 'ph-chalkboard-teacher', color: 'var(--cx-teal)' },
  teaching_assistant: { icon: 'ph-hand-heart', color: 'var(--cx-blue)' },
  student: { icon: 'ph-student', color: 'var(--cx-amber)' },
};

export const STATUS_META: Record<UserStatusValue, Meta> = {
  active: { icon: 'ph-check-circle', color: 'var(--cx-teal)' },
  invited: { icon: 'ph-envelope-simple', color: 'var(--cx-blue)' },
  suspended: { icon: 'ph-prohibit', color: 'var(--cx-coral)' },
};

const FALLBACK_META: Meta = { icon: 'ph-circle', color: 'var(--color-neutral-100)' };

export const roleMeta = (key: string): Meta => ROLE_META[key] ?? FALLBACK_META;
export const statusMeta = (key: string): Meta =>
  STATUS_META[key as UserStatusValue] ?? FALLBACK_META;

/* ═══════════════ Nhật ký: nhóm hành động ═══════════════ */

/**
 * Nhóm hành động để tô màu/icon.
 *
 * KHÔNG có nhóm `login`: đã chốt không ghi audit khi đăng nhập (HANDOFF_P10 §T10.5) — mỗi lượt
 * đăng nhập một dòng sẽ phình bảng trên máy 2 GB, mà rate-limit theo danh tính đã chặn ở tầng dưới.
 * Nhóm `award` là phần thêm cho `gamification.award` của T10.3, thiết kế gốc chưa biết tới.
 */
export type AuditGroup = 'create' | 'update' | 'delete' | 'assign' | 'reset' | 'award';

export const GROUP_META: Record<AuditGroup, Meta> = {
  create: { icon: 'ph-plus-circle', color: 'var(--cx-teal)' },
  update: { icon: 'ph-pencil-simple', color: 'var(--cx-blue)' },
  delete: { icon: 'ph-minus-circle', color: 'var(--cx-coral)' },
  assign: { icon: 'ph-user-switch', color: 'var(--cx-purple)' },
  reset: { icon: 'ph-key', color: 'var(--cx-amber)' },
  award: { icon: 'ph-gift', color: 'var(--cx-amber)' },
};

/** `action` của backend → nhóm + hậu tố khoá i18n cho câu mô tả. */
const ACTION_META: Record<string, { group: AuditGroup; key: string }> = {
  'user.create': { group: 'create', key: 'userCreate' },
  'user.update': { group: 'update', key: 'userUpdate' },
  'user.password_change': { group: 'reset', key: 'passwordChange' },
  'user.password_reset': { group: 'reset', key: 'passwordReset' },
  'role.assign': { group: 'assign', key: 'roleAssign' },
  'role.revoke': { group: 'delete', key: 'roleRevoke' },
  'certificate.issue': { group: 'create', key: 'certificateIssue' },
  'certificate.revoke': { group: 'delete', key: 'certificateRevoke' },
  'gamification.award': { group: 'award', key: 'gamificationAward' },
};

export const auditGroup = (action: string): AuditGroup => ACTION_META[action]?.group ?? 'update';

/**
 * Câu mô tả việc đã xảy ra, thay cho `user.create / User / cmt2glny…`.
 *
 * CỐ Ý không tra tên người bị tác động: `metaJson` không lưu tên (INVARIANT #5) và đã chốt giữ
 * nguyên như vậy — câu mô tả chung là đủ. Tên người THỰC HIỆN thì đã có sẵn (`actorName`, backend
 * join từ trước), hiển thị riêng bên cạnh câu.
 */
export function auditSentence(log: AuditLogDto, t: TFunction): string {
  const meta = ACTION_META[log.action];
  // Hành động lạ (thêm sau này mà quên khai ở đây) hiện nguyên `action` — thà thô còn hơn nói sai.
  return meta ? t(`admin.auditSay.${meta.key}`) : log.action;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Vài mẩu chi tiết đọc được, rút từ `metaJson`. Dựng thành chip rời thay vì ghép chuỗi dài —
 * ghép chuỗi thì bản dịch nào cũng gãy ở một ngôn ngữ nào đó.
 */
export function auditChips(log: AuditLogDto, t: TFunction): string[] {
  const m = log.metaJson ?? {};
  const chips: string[] = [];
  const roleLabel = (k: string): string => t(`roles.${k}`, { defaultValue: k });
  const statusLabel = (k: string): string => t(`userStatus.${k}`, { defaultValue: k });

  switch (log.action) {
    case 'user.create': {
      const roles = Array.isArray(m.roleKeys) ? (m.roleKeys as unknown[]).filter(Boolean) : [];
      for (const r of roles) chips.push(roleLabel(String(r)));
      const status = str(m.status);
      if (status) chips.push(statusLabel(status));
      break;
    }
    case 'user.update': {
      const from = str(m.statusFrom);
      const to = str(m.statusTo);
      if (from && to && from !== to) chips.push(`${statusLabel(from)} → ${statusLabel(to)}`);
      break;
    }
    case 'user.password_change':
    case 'user.password_reset': {
      chips.push(t(m.selfService === true ? 'admin.auditSelfService' : 'admin.auditByAdmin'));
      break;
    }
    case 'role.assign':
    case 'role.revoke': {
      const roleKey = str(m.roleKey);
      if (roleKey) chips.push(roleLabel(roleKey));
      if (str(m.classId)) chips.push(t('admin.auditScopedToClass'));
      break;
    }
    case 'gamification.award': {
      const badgeCode = str(m.badgeCode);
      if (badgeCode) chips.push(t('admin.auditBadge', { code: badgeCode }));
      if (typeof m.xpAmount === 'number' && m.xpAmount > 0) {
        chips.push(`+${m.xpAmount} XP`);
      }
      break;
    }
    default:
      break;
  }
  return chips;
}

/* ═══════════════ Thời gian tương đối ═══════════════ */

const hhmm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "Hôm nay · 09:41" / "Hôm qua · 15:02" / "24/08 · 09:41" — mốc ngày theo máy người xem. */
export function auditTime(iso: string, t: TFunction, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, now)) return `${t('admin.auditToday')} · ${hhmm(d)}`;
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (sameDay(d, yesterday)) return `${t('admin.auditYesterday')} · ${hhmm(d)}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} · ${hhmm(d)}`;
}
