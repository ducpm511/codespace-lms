import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Paginated, UserSummary } from '@lms/contracts';
import { apiFetch } from '../lib/api';

export function AdminHome(): JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', { page: 1, pageSize: 20 }],
    queryFn: () => apiFetch<Paginated<UserSummary>>('/users?page=1&pageSize=20'),
  });

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.fullName ?? '').toLowerCase().includes(q),
    );
  }, [data?.items, search]);

  return (
    <section className="space-y-5">
      <h1 className="cx-display text-2xl">{t('admin.title')}</h1>

      {/* Toolbar: tìm kiếm (client-side) + filter/thêm (placeholder — chưa có CRUD tạo user) */}
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
        <button className="btn btn-secondary !rounded-full" disabled title={t('common.comingSoon')}>
          <i className="ph ph-funnel" aria-hidden /> {t('admin.filter')}
        </button>
        <button className="btn btn-primary cx-press ml-auto" disabled title={t('common.comingSoon')}>
          <i className="ph ph-plus" aria-hidden /> {t('admin.addUser')}
        </button>
      </div>

      <div className="panel overflow-hidden" style={{ borderRadius: 'var(--radius-lg)' }}>
        <div className="panel-head flex items-center gap-2">
          {t('admin.usersHeading')}
          {data && <span className="text-muted text-sm">({data.total})</span>}
        </div>

        {isLoading && <p className="text-muted px-4 py-6">{t('common.loading')}</p>}
        {isError && <p className="px-4 py-6 text-red-400">{t('common.error')}</p>}
        {data && rows.length === 0 && <p className="text-muted px-4 py-6">{t('admin.empty')}</p>}

        {data && rows.length > 0 && (
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
    </section>
  );
}
