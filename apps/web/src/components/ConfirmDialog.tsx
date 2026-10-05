import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './useConfirm';

/**
 * Hộp xác nhận trong app, thay `window.confirm()`.
 *
 * Vì sao không dùng `confirm()` của trình duyệt: khi trình duyệt chặn hộp thoại (người dùng từng
 * tick "chặn hộp thoại của trang này", trình duyệt nhúng trong app, webview…) thì `confirm()` trả
 * `false` NGAY, không hiện gì — bấm "Xóa" và không có chuyện gì xảy ra, trông như nút hỏng.
 * Đây chính là lỗi "không xóa được bài tập" trên production.
 */
export function ConfirmProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // Đang mở một hộp khác → coi như hủy hộp cũ, không để promise treo.
    resolver.current?.(false);
    setPending(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="dialog-backdrop" onClick={() => close(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            style={{ borderRadius: 'var(--cx-radius)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close(false);
            }}
          >
            <p className="dialog-title cx-display m-0">{pending.title ?? t('common.confirmTitle')}</p>
            <p className="dialog-body m-0" style={{ whiteSpace: 'pre-line' }}>
              {pending.message}
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary cx-press" onClick={() => close(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary cx-press"
                style={{ color: 'var(--cx-coral)', borderColor: 'var(--cx-coral)' }}
                autoFocus
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
