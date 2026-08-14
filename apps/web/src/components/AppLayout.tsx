import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogout, useMe } from '../features/auth/hooks';
import { allowedAreas } from '../lib/roles';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();

  const areas = user ? allowedAreas(user.roles) : [];
  const displayName = user?.fullName || user?.email || '';

  const onLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  };

  return (
    <div className="min-h-screen">
      <header
        className="border-b"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-divider)' }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <img src="/brand/logo-horizontal-white.png" alt={t('app.name')} className="h-[26px] w-auto" />
            <nav className="flex gap-1">
              {areas.map((area) => (
                <NavLink
                  key={area}
                  to={`/${area}`}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm ${
                      isActive ? 'nav-active' : 'text-[var(--color-text)]/75 hover:bg-white/5'
                    }`
                  }
                >
                  {t(`nav.${area}`)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: 'var(--color-accent-800)', color: 'var(--color-accent-100)' }}
                  title={displayName}
                >
                  {initials(displayName)}
                </span>
                <span className="hidden text-[var(--color-text)]/75 sm:inline">{displayName}</span>
              </span>
            )}
            <button onClick={onLogout} disabled={logout.isPending} className="btn btn-secondary">
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
