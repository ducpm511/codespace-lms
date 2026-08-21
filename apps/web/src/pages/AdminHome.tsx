import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SYSTEM_ROLES } from '@lms/contracts';
import type { AuditLogDto, UserStatusValue, UserSummary } from '@lms/contracts';
import { useAuditLogs } from '../features/audit/useAuditLogs';
import { useUsers } from '../features/users/hooks';
import { UserFormDialog } from '../features/users/UserFormDialog';
import { ResetPasswordDialog } from '../features/users/ResetPasswordDialog';
import { useDebounced } from '../lib/useDebounced';

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
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);

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
    setSelectedLog(null);
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
            <i className="ph ph-users mr-1.5" aria-hidden /> {t('admin.usersHeading')}
          </button>
          <button
            className={`seg-btn cx-press ${tab === 'audit' ? 'seg-active' : ''}`}
            onClick={() => switchTab('audit')}
          >
            <i className="ph ph-shield-check mr-1.5" aria-hidden /> {t('admin.auditHeading')}
          </button>
        </div>
      </div>

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
                          <span
                            className={u.status === 'active' ? 'tag tag-accent' : 'tag tag-neutral'}
                          >
                            {t(`userStatus.${u.status}`, { defaultValue: u.status })}
                          </span>
                        </td>
                        <td className="text-muted">
                          {u.roles.map((r) => t(`roles.${r}`, { defaultValue: r })).join(', ') || '—'}
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
              <div className="overflow-x-auto px-2 pb-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('admin.auditTime')}</th>
                      <th>{t('admin.auditActor')}</th>
                      <th>{t('admin.auditAction')}</th>
                      <th>{t('admin.auditEntity')}</th>
                      <th>{t('admin.auditEntityId')}</th>
                      <th>{t('admin.auditDetail')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.items.map((log) => (
                      <tr key={log.id}>
                        <td className="text-muted whitespace-nowrap text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="text-xs">
                          <div className="font-semibold">{log.actorName || t('admin.auditSystem')}</div>
                          {log.actorEmail && (
                            <div className="text-muted text-[11px]">{log.actorEmail}</div>
                          )}
                        </td>
                        <td>
                          <span className="tag tag-accent font-mono text-xs">{log.action}</span>
                        </td>
                        <td className="text-xs">{log.entity}</td>
                        <td className="text-muted font-mono text-xs">{log.entityId || '—'}</td>
                        <td>
                          {log.metaJson ? (
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="btn btn-secondary cx-press !rounded-full !px-2.5 !py-1 text-xs"
                            >
                              {t('admin.auditViewJson')}
                            </button>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

      {selectedLog && (
        <div className="dialog-backdrop" onClick={() => setSelectedLog(null)}>
          <div
            className="dialog"
            style={{ width: 'min(640px, 100%)', borderRadius: 'var(--cx-radius)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="dialog-title cx-display">
              {t('admin.auditDetail')}: <span className="font-mono">{selectedLog.action}</span>
            </p>
            <div className="dialog-body space-y-1 text-xs">
              <p>
                <strong>{t('admin.auditActor')}:</strong> {selectedLog.actorName || t('admin.auditSystem')}{' '}
                ({selectedLog.actorEmail || selectedLog.actorId})
              </p>
              <p>
                <strong>{t('admin.auditEntity')}:</strong> {selectedLog.entity} #{selectedLog.entityId}
              </p>
              <p>
                <strong>{t('admin.auditTime')}:</strong>{' '}
                {new Date(selectedLog.createdAt).toLocaleString()}
              </p>
            </div>
            <pre
              className="max-h-72 overflow-auto p-4 font-mono text-xs"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              {JSON.stringify(selectedLog.metaJson, null, 2)}
            </pre>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary !rounded-full"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
