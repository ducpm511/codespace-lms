import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '../features/auth/hooks';

/** Gate theo vai trò ở FE (chỉ là UX — API vẫn tự chặn bằng PBAC guard). */
export function RequireRoles({ roles, children }: { roles: string[]; children: ReactNode }): JSX.Element | null {
  const { t } = useTranslation();
  const { data } = useMe();
  if (!data) return null;
  const allowed = data.roles.some((r) => roles.includes(r));
  if (!allowed) {
    return <p className="p-8 text-center text-slate-500">{t('common.forbidden')}</p>;
  }
  return <>{children}</>;
}
