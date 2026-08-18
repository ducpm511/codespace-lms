import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AuditLogDto, Paginated, UserSummary } from '@lms/contracts';
import { apiFetch } from '../lib/api';
import { useAuditLogs } from '../features/audit/useAuditLogs';

export function AdminHome(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [search, setSearch] = useState('');

  // Audit filters
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);

  const { data: usersData, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ['users', { page: 1, pageSize: 20 }],
    queryFn: () => apiFetch<Paginated<UserSummary>>('/users?page=1&pageSize=20'),
    enabled: tab === 'users',
  });

  const { data: auditData, isLoading: auditLoading, isError: auditError } = useAuditLogs({
    action: actionFilter || undefined,
    pageSize: 50,
  });

  const rows = useMemo(() => {
    const items = usersData?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.fullName ?? '').toLowerCase().includes(q),
    );
  }, [usersData?.items, search]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="cx-display text-2xl">{t('admin.title')}</h1>
        <div className="seg">
          <button
            className={`seg-btn cx-press ${tab === 'users' ? 'seg-active' : ''}`}
            onClick={() => setTab('users')}
          >
            <i className="ph ph-users mr-1.5" aria-hidden /> {t('admin.usersHeading', { defaultValue: 'Người dùng' })}
          </button>
          <button
            className={`seg-btn cx-press ${tab === 'audit' ? 'seg-active' : ''}`}
            onClick={() => setTab('audit')}
          >
            <i className="ph ph-shield-check mr-1.5" aria-hidden /> {t('admin.auditHeading', { defaultValue: 'Nhật ký hệ thống' })}
          </button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <i className="ph ph-magnifying-glass text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
              <input
                className="input pl-9"
                placeholder={t('admin.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="panel overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="panel-head flex items-center gap-2">
              {t('admin.usersHeading')}
              {usersData && <span className="text-muted text-sm">({usersData.total})</span>}
            </div>

            {usersLoading && <p className="text-muted px-4 py-6">{t('common.loading')}</p>}
            {usersError && <p className="px-4 py-6 text-red-400">{t('common.error')}</p>}
            {usersData && rows.length === 0 && <p className="text-muted px-4 py-6">{t('admin.empty')}</p>}

            {usersData && rows.length > 0 && (
              <div className="overflow-x-auto px-2 pb-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('admin.email')}</th>
                      <th>{t('admin.name')}</th>
                      <th>{t('admin.status')}</th>
                      <th>{t('admin.roles')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id}>
                        <td>{u.email}</td>
                        <td>{u.fullName}</td>
                        <td>
                          <span className={u.status === 'active' ? 'tag tag-accent' : 'tag tag-neutral'}>
                            {u.status}
                          </span>
                        </td>
                        <td className="text-muted">
                          {u.roles.map((r) => t(`roles.${r}`, { defaultValue: r })).join(', ') || '—'}
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

      {tab === 'audit' && (
        <div className="space-y-5">
          {/* Toolbar filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Hành động:</span>
              <input
                className="input py-1.5 text-xs w-48"
                placeholder="Lọc action (vd: certificate.issue)..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="panel overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="panel-head flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Nhật ký kiểm toán (Audit Logs)</span>
                {auditData && <span className="text-muted text-sm">({auditData.total})</span>}
              </div>
            </div>

            {auditLoading && <p className="text-muted px-4 py-6">{t('common.loading')}</p>}
            {auditError && <p className="px-4 py-6 text-red-400">{t('common.error')}</p>}
            {auditData && auditData.items.length === 0 && (
              <p className="text-muted px-4 py-6">Không có bản ghi nhật ký nào.</p>
            )}

            {auditData && auditData.items.length > 0 && (
              <div className="overflow-x-auto px-2 pb-2">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Người thực hiện</th>
                      <th>Hành động</th>
                      <th>Thực thể</th>
                      <th>ID thực thể</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.items.map((log) => (
                      <tr key={log.id}>
                        <td className="text-xs text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="text-xs">
                          <div className="font-semibold text-white">{log.actorName || 'Hệ thống'}</div>
                          {log.actorEmail && (
                            <div className="text-[11px] text-slate-400">{log.actorEmail}</div>
                          )}
                        </td>
                        <td>
                          <span className="tag tag-accent text-xs font-mono">{log.action}</span>
                        </td>
                        <td className="text-xs text-slate-300">{log.entity}</td>
                        <td className="text-xs font-mono text-slate-400">{log.entityId || '—'}</td>
                        <td>
                          {log.metaJson ? (
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="btn btn-secondary !py-1 !px-2.5 text-xs !rounded-lg"
                            >
                              Xem JSON
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
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

      {/* JSON Meta Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>🔍</span> Chi tiết Audit Log: <span className="font-mono text-amber-400">{selectedLog.action}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="text-xs space-y-1 text-slate-300">
              <p><strong>Actor:</strong> {selectedLog.actorName} ({selectedLog.actorEmail || selectedLog.actorId})</p>
              <p><strong>Entity:</strong> {selectedLog.entity} #{selectedLog.entityId}</p>
              <p><strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}</p>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-auto max-h-72 border border-slate-800">
              {JSON.stringify(selectedLog.metaJson, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary !rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
