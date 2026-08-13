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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="text-center">
          <h1 className="text-lg font-semibold">{t('app.name')}</h1>
          <p className="text-sm text-slate-500">{t('app.tagline')}</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-slate-700">{t('login.email')}</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-700">{t('login.password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
          />
        </label>

        {loginMut.isError && <p className="text-sm text-red-600">{t('login.failed')}</p>}

        <button
          type="submit"
          disabled={loginMut.isPending}
          className="w-full rounded bg-slate-900 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loginMut.isPending ? t('login.loading') : t('login.submit')}
        </button>
      </form>
    </div>
  );
}
