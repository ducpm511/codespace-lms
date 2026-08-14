import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Paginated, UserSummary } from '@lms/contracts';
import { apiFetch } from '../lib/api';

export function AdminHome(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', { page: 1, pageSize: 20 }],
    queryFn: () => apiFetch<Paginated<UserSummary>>('/users?page=1&pageSize=20'),
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl">{t('admin.title')}</h1>

      <div className="panel overflow-hidden">
        <div className="panel-head flex items-center gap-2">
          {t('admin.usersHeading')}
          {data && <span className="text-muted text-sm">({data.total})</span>}
        </div>

        {isLoading && <p className="text-muted px-4 py-6">{t('common.loading')}</p>}
        {isError && <p className="px-4 py-6 text-red-400">{t('common.error')}</p>}
        {data && data.items.length === 0 && <p className="text-muted px-4 py-6">{t('admin.empty')}</p>}

        {data && data.items.length > 0 && (
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
                {data.items.map((u) => (
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
