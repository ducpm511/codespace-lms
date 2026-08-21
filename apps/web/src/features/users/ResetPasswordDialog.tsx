import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PASSWORD_MIN_LENGTH } from '@lms/contracts';
import type { UserSummary } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useResetUserPassword } from './hooks';

/**
 * Admin đặt lại mật khẩu cho một tài khoản. Chưa có email provider (T9.6) nên mật khẩu mới
 * do admin tự nghĩ và tự chuyển cho học viên — cảnh báo rõ trong dialog rằng tất cả thiết bị
 * của người đó sẽ bị đăng xuất.
 */
export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserSummary;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<number | null>(null);
  const reset = useResetUserPassword();

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    setFailure(null);
    reset.mutate(
      { id: user.id, newPassword },
      {
        onSuccess: (res) => setRevoked(res.revokedSessions),
        onError: (err) => setFailure(err instanceof ApiError ? err.message : String(err)),
      },
    );
  };

  if (revoked !== null) {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div
          className="dialog"
          style={{ borderRadius: 'var(--cx-radius)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="dialog-title cx-display">{t('admin.resetPasswordDone')}</p>
          <p className="dialog-body">
            {t('admin.resetPasswordDoneBody', { name: user.fullName, count: revoked })}
          </p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary cx-press" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="dialog"
        style={{ borderRadius: 'var(--cx-radius)' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <p className="dialog-title cx-display">{t('admin.resetPassword')}</p>
        <p className="dialog-body">
          {t('admin.resetPasswordBody', { name: user.fullName, email: user.email })}
        </p>

        <div className="field">
          <label>{t('admin.newPassword')}</label>
          <input
            className="input"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
            autoFocus
            autoComplete="off"
          />
          <p className="text-muted mt-1 text-xs">
            {t('admin.resetPasswordHint', { min: PASSWORD_MIN_LENGTH })}
          </p>
        </div>

        {failure && <p className="text-sm text-red-400">{failure}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary !rounded-full" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary cx-press" disabled={reset.isPending}>
            {reset.isPending ? t('common.loading') : t('admin.resetPasswordConfirm')}
          </button>
        </div>
      </form>
    </div>
  );
}
