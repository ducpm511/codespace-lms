import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PASSWORD_MIN_LENGTH, SYSTEM_ROLES } from '@lms/contracts';
import type { UserStatusValue, UserSummary } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useAssignRole, useCreateUser, useRevokeRole, useUpdateUser } from './hooks';

const STATUSES: UserStatusValue[] = ['invited', 'active', 'suspended'];

function errorMessage(err: unknown): string | null {
  if (err instanceof ApiError) return err.message;
  return err ? String(err) : null;
}

/**
 * Tạo mới hoặc sửa người dùng.
 *
 * Sửa thì email KHÔNG đổi được: backend không có endpoint đổi email, và email là khoá đăng nhập —
 * cho sửa ở đây sẽ im lặng không có tác dụng. Vai trò được gán/gỡ bằng endpoint riêng
 * (`POST/DELETE /users/:id/roles`), nên khi sửa phải tính phần chênh lệch rồi bắn từng lượt.
 */
export function UserFormDialog({
  user,
  onClose,
}: {
  user: UserSummary | null;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const isEdit = user !== null;

  const [email, setEmail] = useState(user?.email ?? '');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<UserStatusValue>(
    (user?.status as UserStatusValue) ?? 'invited',
  );
  const [roleKeys, setRoleKeys] = useState<string[]>(user?.roles ?? []);
  const [failure, setFailure] = useState<string | null>(null);

  const create = useCreateUser();
  const update = useUpdateUser();
  const assign = useAssignRole();
  const revoke = useRevokeRole();
  const busy = create.isPending || update.isPending || assign.isPending || revoke.isPending;

  const toggleRole = (key: string): void =>
    setRoleKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFailure(null);
    try {
      if (!isEdit) {
        await create.mutateAsync({ email, password, fullName, status, roleKeys });
      } else {
        await update.mutateAsync({ id: user.id, body: { fullName, status } });
        const before = user.roles;
        for (const key of roleKeys.filter((k) => !before.includes(k))) {
          await assign.mutateAsync({ id: user.id, roleKey: key });
        }
        for (const key of before.filter((k) => !roleKeys.includes(k))) {
          await revoke.mutateAsync({ id: user.id, roleKey: key });
        }
      }
      onClose();
    } catch (err) {
      setFailure(errorMessage(err));
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="dialog"
        style={{ borderRadius: 'var(--cx-radius)' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void submit(e)}
      >
        <p className="dialog-title cx-display">
          {isEdit ? t('admin.editUser') : t('admin.addUser')}
        </p>

        <div className="field">
          <label>{t('admin.email')}</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEdit}
            required
            autoFocus={!isEdit}
          />
          {isEdit && <p className="text-muted mt-1 text-xs">{t('admin.emailLocked')}</p>}
        </div>

        <div className="field">
          <label>{t('admin.name')}</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        {!isEdit && (
          <div className="field">
            <label>{t('admin.initialPassword')}</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <p className="text-muted mt-1 text-xs">
              {t('admin.passwordHint', { min: PASSWORD_MIN_LENGTH })}
            </p>
          </div>
        )}

        <div className="field">
          <label>{t('admin.status')}</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatusValue)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`userStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('admin.roles')}</label>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_ROLES.map((key) => {
              const on = roleKeys.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`btn cx-press !rounded-full ${on ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={on}
                  onClick={() => toggleRole(key)}
                >
                  {on && <i className="ph ph-check" aria-hidden />}
                  {t(`roles.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {failure && <p className="text-sm text-red-400">{failure}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary !rounded-full" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary cx-press" disabled={busy}>
            {busy ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
