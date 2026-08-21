import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogout, useMe } from '../features/auth/hooks';
import { ChangePasswordDialog } from '../features/auth/ChangePasswordDialog';
import { useMyGamification } from '../features/gamification/useGamification';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { allowedAreas } from '../lib/roles';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AREA_ICON: Record<string, string> = {
  learn: 'ph-graduation-cap',
  teach: 'ph-chalkboard-teacher',
  admin: 'ph-shield-check',
};

export function AppLayout(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const { data: gamification } = useMyGamification();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi bấm ra ngoài — cùng cách NotificationBell đang làm.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const areas = user ? allowedAreas(user.roles) : [];
  const displayName = user?.fullName || user?.email || '';
  const currentStreak = gamification?.streak?.current ?? 0;

  const onLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  };

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 82%, transparent)',
          borderColor: 'var(--color-divider)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <img src="/brand/logo-horizontal-white.png" alt={t('app.name')} className="h-[26px] w-auto" />
          <nav className="mr-auto flex items-center gap-1">
            {areas.map((area) => (
              <NavLink
                key={area}
                to={`/${area}`}
                className={({ isActive }) =>
                  `btn cx-press gap-1.5 ${isActive ? 'nav-active !rounded-full' : ''}`
                }
                style={({ isActive }) =>
                  isActive ? undefined : { color: 'color-mix(in srgb, var(--color-text) 75%, transparent)' }
                }
              >
                <i className={`ph ${AREA_ICON[area] ?? 'ph-circle'} text-base`} aria-hidden />
                <span className="hidden sm:inline">{t(`nav.${area}`)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Streak pill — Real gamification */}
            <span
              className="hidden items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium sm:inline-flex"
              style={{
                background: 'color-mix(in srgb, var(--cx-amber) 16%, transparent)',
                border: '1px solid color-mix(in srgb, var(--cx-amber) 34%, transparent)',
              }}
              title={t('nav.streakTitle')}
            >
              <i className="ph-fill ph-fire" style={{ color: 'var(--cx-amber)' }} aria-hidden />
              <span style={{ color: 'var(--cx-amber)' }}>{currentStreak}</span>
            </span>
            <NotificationBell />
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  title={displayName}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(150deg, var(--cx-purple), var(--cx-coral))' }}
                  >
                    {initials(displayName)}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-[var(--color-text)]/80 md:inline">
                    {displayName}
                  </span>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden p-1"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-divider)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <p className="text-muted truncate px-3 py-2 text-xs">{user.email}</p>
                    <button
                      type="button"
                      role="menuitem"
                      className="btn btn-secondary !w-full !justify-start !border-transparent"
                      onClick={() => {
                        setMenuOpen(false);
                        setChangingPassword(true);
                      }}
                    >
                      <i className="ph ph-key" aria-hidden /> {t('account.changePassword')}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={onLogout} disabled={logout.isPending} className="btn btn-secondary !rounded-full">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
    </div>
  );
}
