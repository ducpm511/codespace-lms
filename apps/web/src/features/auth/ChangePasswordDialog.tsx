import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PASSWORD_MIN_LENGTH } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useChangePassword } from './hooks';

/**
 * Đổi mật khẩu tự phục vụ. Đổi xong là mọi phiên bị thu hồi, kể cả tab đang mở, nên
 * điều hướng thẳng về /login — báo trước trong dialog để người dùng không tưởng là lỗi.
 */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const change = useChangePassword();

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFailure(t('account.passwordMismatch'));
      return;
    }
    setFailure(null);
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => navigate('/login', { replace: true }),
        onError: (err) => setFailure(err instanceof ApiError ? err.message : String(err)),
      },
    );
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="dialog"
        style={{ borderRadius: 'var(--cx-radius)' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <p className="dialog-title cx-display">{t('account.changePassword')}</p>
        <p className="dialog-body">{t('account.changePasswordBody')}</p>

        <div className="field">
          <label>{t('account.currentPassword')}</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label>{t('account.newPassword')}</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <p className="text-muted mt-1 text-xs">
            {t('account.passwordHint', { min: PASSWORD_MIN_LENGTH })}
          </p>
        </div>

        <div className="field">
          <label>{t('account.confirmPassword')}</label>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
        </div>

        {failure && <p className="text-sm text-red-400">{failure}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary !rounded-full" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary cx-press" disabled={change.isPending}>
            {change.isPending ? t('common.loading') : t('account.changePassword')}
          </button>
        </div>
      </form>
    </div>
  );
}
