import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  message: string;
  title?: string;
  /** Nhãn nút đồng ý; mặc định "Xóa" vì gần như mọi chỗ hỏi lại đều là xóa. */
  confirmLabel?: string;
}

export type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Hỏi lại trước thao tác nguy hiểm — thay `window.confirm()`. Xem `ConfirmProvider`. */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm phải nằm trong <ConfirmProvider>');
  return fn;
}
