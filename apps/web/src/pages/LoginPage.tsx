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
        {/* Décor: 2 quầng sáng + watermark logo + sao băng + đốm lấp lánh */}
        <span
          className="pointer-events-none absolute"
          style={{
            width: 340, height: 340, top: -60, left: -40, borderRadius: '50%',
            background: 'var(--color-section-ghost)', filter: 'blur(60px)', opacity: 0.55,
          }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute"
          style={{
            width: 300, height: 300, bottom: 40, right: -20, borderRadius: '50%',
            background: 'var(--color-section-ghost)', filter: 'blur(60px)', opacity: 0.5,
          }}
          aria-hidden
        />
        <img
          src="/brand/logo-vertical-white.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -right-16 w-[520px] opacity-[0.06]"
        />
        <span className="cx-shooting-star" style={{ top: '10%', right: '18%', animationDelay: '0s' }} aria-hidden />
        <span className="cx-shooting-star" style={{ top: '28%', right: '42%', animationDelay: '1.8s' }} aria-hidden />
        <span className="cx-shooting-star" style={{ top: '55%', right: '12%', animationDelay: '3.2s' }} aria-hidden />
        {[
          { top: '18%', left: '22%', s: 4, o: 0.4 },
          { top: '30%', left: '70%', s: 3, o: 0.35 },
          { top: '62%', left: '30%', s: 5, o: 0.45 },
          { top: '74%', left: '64%', s: 3, o: 0.3 },
          { top: '44%', left: '80%', s: 4, o: 0.4 },
        ].map((d, i) => (
          <span
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{ top: d.top, left: d.left, width: d.s, height: d.s, background: 'var(--color-neutral-100)', opacity: d.o }}
            aria-hidden
          />
        ))}
        <img
          src="/brand/logo-horizontal-white.png"
          alt={t('app.name')}
          className="absolute left-8 top-8 h-[30px] w-auto opacity-90"
        />
        <div className="relative z-10 max-w-[380px] text-center">
          <img
            src="/brand/mascot-laptop.png"
            alt=""
            aria-hidden
            className="cx-float mx-auto mb-6 w-[280px]"
            style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.4))' }}
          />
          <h2 className="cx-display mb-2 text-[28px]">{t('login.bannerHeading')}</h2>
          <p className="text-[var(--color-text)]/70">{t('login.bannerSub')}</p>
        </div>
      </div>

      {/* Form phải */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-8 py-12">
        <span className="cx-blob" style={{ width: 280, height: 280, top: -40, left: -40, background: 'var(--cx-purple)', opacity: 0.28 }} aria-hidden />
        <span className="cx-blob" style={{ width: 220, height: 220, bottom: -30, right: -30, background: 'var(--cx-teal)', opacity: 0.24 }} aria-hidden />
        <form onSubmit={onSubmit} className="relative z-10 w-full max-w-[360px] space-y-4">
          <div>
            <h1 className="cx-display text-[30px]">{t('login.title')}</h1>
            <p className="text-muted text-sm">{t('login.tagline')}</p>
          </div>

          <div className="field">
            <label>{t('login.email')}</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              placeholder="ten@codespace.vn"
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
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {loginMut.isError && <p className="text-sm text-red-400">{t('login.failed')}</p>}

          <button type="submit" disabled={loginMut.isPending} className="btn btn-primary btn-block cx-press">
            <i className="ph ph-rocket-launch" aria-hidden />
            {loginMut.isPending ? t('login.loading') : t('login.submit')}
          </button>

          <p className="text-muted text-center text-xs">{t('login.footer')}</p>
        </form>
      </div>
    </div>
  );
}
