import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SYSTEM_ROLES } from '@lms/contracts';
import type { AuditLogDto, UserStatusValue, UserSummary } from '@lms/contracts';
import { useAuditLogs } from '../features/audit/useAuditLogs';
import { useAdminOverview } from '../features/admin/hooks';
import { useUsers } from '../features/users/hooks';
import { UserFormDialog } from '../features/users/UserFormDialog';
import { ResetPasswordDialog } from '../features/users/ResetPasswordDialog';
import { useDebounced } from '../lib/useDebounced';
import type { Meta } from './admin/adminUi';
import {
  GROUP_META,
  auditChips,
  auditGroup,
  auditSentence,
  auditTime,
  roleMeta,
  statusMeta,
} from './admin/adminUi';

const PAGE_SIZE = 20;
const STATUSES: UserStatusValue[] = ['invited', 'active', 'suspended'];

export function AdminHome(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'users' | 'audit'>('users');

  // Bộ lọc người dùng — tất cả chạy Ở SERVER (GET /users?search=&status=&roleKey=).
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  // Đổi bộ lọc mà giữ nguyên số trang thì dễ rơi vào trang trống (kết quả mới ít hơn).
  useEffect(() => setPage(1), [debouncedSearch, statusFilter, roleFilter]);

  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserSummary | null>(null);

  // Audit filters
  const [actionFilter, setActionFilter] = useState('');
  // Mở rộng metaJson NGAY TRÊN DÒNG thay vì modal — xem chi tiết một dòng không nên che mất
  // ngữ cảnh của các dòng quanh nó.
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const {
    data: usersData,
    isLoading: usersLoading,
    isError: usersError,
  } = useUsers(
    {
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      roleKey: roleFilter || undefined,
    },
    tab === 'users',
  );

  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
  } = useAuditLogs({ action: actionFilter || undefined, pageSize: 50 }, tab === 'audit');

  const rows = usersData?.items ?? [];
  const total = usersData?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const switchTab = (next: 'users' | 'audit'): void => {
    setTab(next);
    // Không để dialog treo lại sau khi đổi khu vực (design handoff §9).
    setEditing(null);
    setCreating(false);
    setResetting(null);
    setExpandedLogId(null);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="cx-display text-2xl">{t('admin.title')}</h1>
        <div className="seg">
          <button
            className={`seg-btn cx-press ${tab === 'users' ? 'seg-active' : ''}`}
            onClick={() => switchTab('users')}
          >
            <i className="ph ph-users-three mr-1.5" aria-hidden /> {t('admin.tabUsers')}
          </button>
          <button
            className={`seg-btn cx-press ${tab === 'audit' ? 'seg-active' : ''}`}
            onClick={() => switchTab('audit')}
          >
            <i className="ph ph-shield-check mr-1.5" aria-hidden /> {t('admin.tabAudit')}
          </button>
        </div>
      </div>

      <AdminStats />

      {tab === 'users' && (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <i
                className="ph ph-magnifying-glass text-muted absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden
              />
              <input
                className="input pl-9"
                placeholder={t('admin.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="input w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t('admin.status')}
            >
              <option value="">{t('admin.allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`userStatus.${s}`)}
                </option>
              ))}
            </select>

            <select
              className="input w-auto"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label={t('admin.roles')}
            >
              <option value="">{t('admin.allRoles')}</option>
              {SYSTEM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-primary cx-press ml-auto"
              onClick={() => setCreating(true)}
            >
              <i className="ph ph-plus" aria-hidden /> {t('admin.addUser')}
            </button>
          </div>

          <div className="panel overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="panel-head flex items-center gap-2">
              {t('admin.usersHeading')}
              {usersData && <span className="text-muted text-sm">({total})</span>}
            </div>

            {usersLoading && <p className="text-muted px-4 py-6">{t('common.loading')}</p>}
            {usersError && <p className="px-4 py-6 text-red-400">{t('common.error')}</p>}
            {usersData && rows.length === 0 && (
              <p className="text-muted px-4 py-6">{t('admin.empty')}</p>
            )}

            {usersData && rows.length > 0 && (
              <div className="overflow-x-auto px-2 pb-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('admin.email')}</th>
                      <th>{t('admin.name')}</th>
                      <th>{t('admin.status')}</th>
                      <th>{t('admin.roles')}</th>
                      <th className="text-right">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id}>
                        <td>{u.email}</td>
                        <td>{u.fullName}</td>
                        <td>
                          <MetaChip
                            meta={statusMeta(u.status)}
                            label={t(`userStatus.${u.status}`, { defaultValue: u.status })}
                          />
                        </td>
                        <td>
                          {u.roles.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {u.roles.map((r) => (
                                <MetaChip
                                  key={r}
                                  meta={roleMeta(r)}
                                  label={t(`roles.${r}`, { defaultValue: r })}
                                />
                              ))}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="btn btn-secondary cx-press !rounded-full !px-2.5 !py-1 text-xs"
                              onClick={() => setEditing(u)}
                            >
                              <i className="ph ph-pencil-simple" aria-hidden /> {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary cx-press !rounded-full !px-2.5 !py-1 text-xs"
                              onClick={() => setResetting(u)}
                            >
                              <i className="ph ph-key" aria-hidden /> {t('admin.resetPassword')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {usersData && total > PAGE_SIZE && (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{ borderTop: '1px solid var(--color-divider)' }}
              >
                <span className="text-muted text-sm">
                  {t('admin.pageOf', { page, lastPage, total })}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary cx-press !rounded-full"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <i className="ph ph-caret-left" aria-hidden /> {t('admin.prevPage')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary cx-press !rounded-full"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  >
                    {t('admin.nextPage')} <i className="ph ph-caret-right" aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-5">
          {/* Toolbar filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted text-xs">{t('admin.auditAction')}</span>
              <input
                className="input w-48 py-1.5 text-xs"
                placeholder={t('admin.auditActionPlaceholder')}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="panel overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="panel-head flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{t('admin.auditHeading')}</span>
                {auditData && <span className="text-muted text-sm">({auditData.total})</span>}
              </div>
            </div>

            {auditLoading && <p className="text-muted px-4 py-6">{t('common.loading')}</p>}
            {auditError && <p className="px-4 py-6 text-red-400">{t('common.error')}</p>}
            {auditData && auditData.items.length === 0 && (
              <p className="text-muted px-4 py-6">{t('admin.auditEmpty')}</p>
            )}

            {auditData && auditData.items.length > 0 && (
              <ul className="flex flex-col gap-2 px-2 pb-3 pt-1">
                {auditData.items.map((log) => (
                  <AuditRow
                    key={log.id}
                    log={log}
                    expanded={expandedLogId === log.id}
                    onToggle={() =>
                      setExpandedLogId((cur) => (cur === log.id ? null : log.id))
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <UserFormDialog
          user={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {resetting && (
        <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      )}

    </section>
  );
}

/* ═══════════════ Dãy số liệu tổng quan (T10.5) ═══════════════ */
function AdminStats(): JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useAdminOverview();

  // Chưa có số thì không chiếm chỗ bằng 4 ô "0" — con số sai còn tệ hơn không có con số.
  if (!data) return null;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}
    >
      <StatTile
        icon="ph-chalkboard-teacher"
        color="var(--cx-teal)"
        value={data.teacherCount}
        label={t('admin.statTeachers')}
      />
      <StatTile
        icon="ph-student"
        color="var(--cx-amber)"
        value={data.studentCount}
        label={t('admin.statStudents')}
      />
      <StatTile
        icon="ph-users-three"
        color="var(--cx-purple)"
        value={data.activeClassCount}
        label={t('admin.statActiveClasses')}
      />
      <StatTile
        icon="ph-books"
        color="var(--cx-blue)"
        value={data.publishedCourseCount}
        label={t('admin.statPublishedCourses')}
      />
    </div>
  );
}

/* ═══════════════ Một dòng nhật ký, viết thành câu (T10.5) ═══════════════ */
function AuditRow({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLogDto;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const meta = GROUP_META[auditGroup(log.action)];
  const chips = auditChips(log, t);
  const hasMeta = log.metaJson != null && Object.keys(log.metaJson).length > 0;

  return (
    <li
      style={{
        borderRadius: 16,
        background: 'var(--color-surface)',
        boxShadow: 'inset 0 0 0 1px var(--color-divider)',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
          style={{
            background: `color-mix(in srgb, ${meta.color} 18%, transparent)`,
            color: meta.color,
          }}
        >
          <i className={`ph-fill ${meta.icon}`} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="m-0" style={{ fontSize: 13 }}>
            {auditSentence(log, t)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted" style={{ fontSize: 11 }}>
              {log.actorName || t('admin.auditSystem')}
            </span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              ·
            </span>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {auditTime(log.createdAt, t)}
            </span>
            {chips.map((c) => (
              <span
                key={c}
                className="text-muted"
                style={{
                  borderRadius: 999,
                  padding: '1px 8px',
                  fontSize: 11,
                  boxShadow: 'inset 0 0 0 1px var(--color-divider)',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        {hasMeta && (
          <button
            type="button"
            onClick={onToggle}
            className="btn btn-secondary cx-press shrink-0 !rounded-full !px-2.5 !py-1 text-xs"
            aria-expanded={expanded}
          >
            <i className={`ph ${expanded ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />{' '}
            {t('admin.auditDetail')}
          </button>
        )}
      </div>

      {expanded && hasMeta && (
        <pre
          className="mt-3 max-h-60 overflow-auto p-3 font-mono text-xs"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {JSON.stringify(log.metaJson, null, 2)}
        </pre>
      )}
    </li>
  );
}

/* ═══════════════ Mảnh dùng chung của khu Quản trị ═══════════════ */

/** Chip vai trò / trạng thái: icon Phosphor fill + màu riêng, nền pha loãng trên nền tối. */
function MetaChip({ meta, label }: { meta: Meta; label: string }): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap"
      style={{
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: 11,
        background: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
        color: meta.color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 34%, transparent)`,
      }}
    >
      <i className={`ph-fill ${meta.icon}`} aria-hidden /> {label}
    </span>
  );
}

function StatTile({
  icon,
  color,
  value,
  label,
}: {
  icon: string;
  color: string;
  value: number | string;
  label: string;
}): JSX.Element {
  return (
    <div
      className="cx-lift flex items-center gap-3"
      style={{
        borderRadius: 18,
        padding: 'var(--space-5)',
        background: 'var(--color-surface)',
        boxShadow: 'inset 0 0 0 1px var(--color-divider)',
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
        style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
      >
        <i className={`ph-fill ${icon}`} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="cx-display m-0" style={{ fontSize: 22, lineHeight: 1.1 }}>
          {value}
        </p>
        <p className="text-muted m-0 truncate" style={{ fontSize: 11 }}>
          {label}
        </p>
      </div>
    </div>
  );
}
