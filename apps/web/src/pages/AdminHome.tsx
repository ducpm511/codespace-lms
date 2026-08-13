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
      <h1 className="text-xl font-semibold">{t('admin.title')}</h1>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 font-medium">
          {t('admin.usersHeading')}
          {data && <span className="ml-2 text-sm text-slate-400">({data.total})</span>}
        </div>

        {isLoading && <p className="px-4 py-6 text-slate-500">{t('common.loading')}</p>}
        {isError && <p className="px-4 py-6 text-red-600">{t('common.error')}</p>}
        {data && data.items.length === 0 && <p className="px-4 py-6 text-slate-500">{t('admin.empty')}</p>}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">{t('admin.email')}</th>
                  <th className="px-4 py-2 font-medium">{t('admin.name')}</th>
                  <th className="px-4 py-2 font-medium">{t('admin.status')}</th>
                  <th className="px-4 py-2 font-medium">{t('admin.roles')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">{u.fullName}</td>
                    <td className="px-4 py-2">{u.status}</td>
                    <td className="px-4 py-2 text-slate-600">
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
