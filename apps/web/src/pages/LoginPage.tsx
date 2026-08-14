import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogin, useMe } from '../features/auth/hooks';

export function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const loginMut = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Đã đăng nhập → về trang chính.
  if (user) return <Navigate to="/" replace />;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMut.mutate({ email, password }, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Banner trái */}
      <div
        className="relative flex items-center justify-center overflow-hidden px-8 py-12 md:min-h-screen md:basis-[48%]"
        style={{
          background: 'linear-gradient(155deg, var(--color-section), var(--color-section-glow))',
        }}
      >
        <img
          src="/brand/logo-horizontal-white.png"
          alt={t('app.name')}
          className="absolute left-8 top-8 h-[30px] w-auto opacity-90"
        />
        <img
          src="/brand/logo-vertical-white.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -right-10 w-[420px] opacity-[0.06]"
        />
        <div className="relative z-10 max-w-[360px] text-center">
          <img
            src="/brand/mascot-laptop.png"
            alt=""
            aria-hidden
            className="mx-auto mb-6 w-[220px]"
            style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.35))' }}
          />
          <h2 className="mb-2">{t('login.bannerHeading')}</h2>
          <p className="text-[var(--color-text)]/70">{t('login.bannerSub')}</p>
        </div>
      </div>

      {/* Form phải */}
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-[360px] space-y-4">
          <div>
            <h1 className="text-[26px]">{t('login.title')}</h1>
            <p className="text-muted text-sm">{t('app.tagline')}</p>
          </div>

          <div className="field">
            <label>{t('login.email')}</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>{t('login.password')}</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {loginMut.isError && <p className="text-sm text-red-400">{t('login.failed')}</p>}

          <button type="submit" disabled={loginMut.isPending} className="btn btn-primary btn-block">
            {loginMut.isPending ? t('login.loading') : t('login.submit')}
          </button>

          <p className="text-muted text-center text-xs">{t('login.footer')}</p>
        </form>
      </div>
    </div>
  );
}
