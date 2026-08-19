/**
 * Ngữ pháp layout dùng chung cho MỌI tab Giảng dạy (design handoff §7):
 * sidebar 308px (header icon chip → card "sticker" → pill tạo mới) + cột detail
 * (header .card + các <section> có icon chip đứng đầu).
 * Chỉ là lớp trình bày — không chứa logic gọi API.
 */
import type { ReactNode } from 'react';

/** Ô icon bo tròn nền tint theo màu category. */
export function IconTile({
  icon,
  color,
  size = 52,
  fill = true,
}: {
  icon: string;
  color: string;
  size?: number;
  fill?: boolean;
}): JSX.Element {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 44 ? 16 : 12,
        background: `color-mix(in srgb, ${color} 20%, transparent)`,
        color,
        fontSize: Math.round(size * 0.5),
      }}
    >
      <i className={`${fill ? 'ph-fill' : 'ph'} ${icon}`} aria-hidden />
    </span>
  );
}

/** Khung 2 cột: sidebar 308px + cột detail minmax(0,1fr). */
export function TeachShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <div
      className="grid lg:grid-cols-[308px_minmax(0,1fr)]"
      style={{ gap: 'var(--space-6)', alignItems: 'start' }}
    >
      <div className="min-w-0">{sidebar}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Cột trái: header có icon chip, danh sách card, nút pill tạo mới ở đáy. */
export function Sidebar({
  icon,
  color,
  title,
  count,
  children,
  footer,
}: {
  icon: string;
  color: string;
  title: string;
  count?: number;
  children: ReactNode;
  footer?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-4)' }}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} color={color} size={34} />
        <p className="cx-display m-0" style={{ fontSize: 16 }}>
          {title}
        </p>
        {count !== undefined && <span className="tag tag-neutral">{count}</span>}
      </div>
      <div className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
        {children}
      </div>
      {footer}
    </div>
  );
}

/** Card "sticker" trong sidebar. Khi chọn: nền color-mix 14% + ring 1.5px cùng tông. */
export function SidebarCard({
  icon,
  color,
  title,
  meta,
  tag,
  selected,
  onClick,
  children,
}: {
  icon: string;
  color: string;
  title: string;
  meta?: ReactNode;
  tag?: ReactNode;
  selected?: boolean;
  onClick: () => void;
  children?: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cx-lift cx-press w-full text-left"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 'var(--space-5)',
        borderRadius: 18,
        background: selected ? `color-mix(in srgb, ${color} 14%, var(--color-surface))` : 'var(--color-surface)',
        boxShadow: selected
          ? `inset 0 0 0 1.5px color-mix(in srgb, ${color} 55%, transparent)`
          : 'inset 0 0 0 1px var(--color-divider)',
      }}
    >
      <div className="flex w-full items-start gap-3">
        <IconTile icon={icon} color={color} size={38} />
        <div className="min-w-0 flex-1">
          <p className="cx-display m-0 truncate" style={{ fontSize: 14, lineHeight: 1.3 }}>
            {title}
          </p>
          {meta !== undefined && (
            <p className="text-muted m-0 truncate" style={{ fontSize: 11, marginTop: 2 }}>
              {meta}
            </p>
          )}
        </div>
      </div>
      {tag !== undefined && <div className="flex w-full flex-wrap items-center gap-1.5">{tag}</div>}
      {children}
    </button>
  );
}

/** Thanh tiến độ mảnh (card lớp, tiến độ bài). */
export function ProgressBar({
  value,
  height = 6,
  from = 'var(--cx-amber)',
  to = 'var(--cx-teal)',
}: {
  value: number;
  height?: number;
  from?: string;
  to?: string;
}): JSX.Element {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span
      className="block w-full overflow-hidden"
      style={{ height, borderRadius: 999, background: 'color-mix(in srgb, var(--color-text) 12%, transparent)' }}
    >
      <span
        className="block h-full"
        style={{ width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
    </span>
  );
}

/** Header của cột detail: tile 52px + tiêu đề + meta + actions. */
export function DetailHeader({
  icon,
  color,
  title,
  meta,
  actions,
  children,
}: {
  icon: string;
  color: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
      <div className="flex flex-wrap items-start justify-between" style={{ gap: 'var(--space-4)' }}>
        <div className="flex min-w-0 flex-1 items-start gap-3.5" style={{ minWidth: 240 }}>
          <IconTile icon={icon} color={color} />
          <div className="min-w-0 flex-1">
            <h2 className="cx-display m-0 truncate" style={{ fontSize: 20, lineHeight: 1.25 }}>
              {title}
            </h2>
            {meta !== undefined && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {meta}
              </div>
            )}
          </div>
        </div>
        {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** <section> có icon chip đứng đầu + action bên phải. */
export function DetailSection({
  icon,
  color,
  title,
  count,
  action,
  children,
}: {
  icon: string;
  color: string;
  title: string;
  count?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col" style={{ gap: 'var(--space-4)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={icon} color={color} size={34} />
          <h3 className="cx-display m-0 truncate" style={{ fontSize: 16 }}>
            {title}
          </h3>
          {count !== undefined && <span className="tag tag-neutral shrink-0">{count}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Cột detail = chồng section, khoảng cách --space-6. */
export function DetailColumn({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-6)' }}>
      {children}
    </div>
  );
}

/** Khung gợi ý rỗng (chưa chọn gì / danh sách trống). */
export function EmptyHint({ children, icon }: { children: ReactNode; icon?: string }): JSX.Element {
  return (
    <div
      className="text-muted flex flex-col items-center justify-center gap-2 text-center"
      style={{
        borderRadius: 18,
        border: '1px dashed var(--color-divider)',
        padding: 'var(--space-8) var(--space-6)',
        fontSize: 13,
      }}
    >
      {icon && <i className={`ph ${icon}`} style={{ fontSize: 26, opacity: 0.6 }} aria-hidden />}
      <span>{children}</span>
    </div>
  );
}

/** Nút pill (tạo mới ở đáy sidebar, action trong section). */
export function PillButton({
  icon,
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
}: {
  icon?: string;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} cx-press`}
      style={{ borderRadius: 999, justifyContent: 'center' }}
    >
      {icon && <i className={`ph ${icon}`} aria-hidden />}
      {children}
    </button>
  );
}

/** Nút icon nhỏ (sửa/xoá/đảo thứ tự) — dùng token, không dùng class slate-* thô. */
export function IconButton({
  icon,
  title,
  onClick,
  tone = 'neutral',
  disabled,
}: {
  icon: string;
  title: string;
  onClick: () => void;
  tone?: 'neutral' | 'accent' | 'danger';
  disabled?: boolean;
}): JSX.Element {
  const color =
    tone === 'danger'
      ? '#f4a3a3'
      : tone === 'accent'
        ? 'var(--color-accent)'
        : 'color-mix(in srgb, var(--color-text) 60%, transparent)';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="cx-press flex shrink-0 items-center justify-center"
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        color,
        background: 'transparent',
        boxShadow: 'inset 0 0 0 1px var(--color-divider)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <i className={`ph ${icon}`} style={{ fontSize: 15 }} aria-hidden />
    </button>
  );
}
