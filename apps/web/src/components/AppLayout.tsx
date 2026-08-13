import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogout, useMe } from '../features/auth/hooks';
import { allowedAreas } from '../lib/roles';

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();

  const areas = user ? allowedAreas(user.roles) : [];

  const onLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{t('app.name')}</span>
            <nav className="flex gap-1">
              {areas.map((area) => (
                <NavLink
                  key={area}
                  to={`/${area}`}
                  className={({ isActive }) =>
                    `rounded px-3 py-1.5 text-sm ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {t(`nav.${area}`)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user && <span className="text-slate-500">{t('common.signedInAs')} {user.email}</span>}
            <button
              onClick={onLogout}
              disabled={logout.isPending}
              className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
