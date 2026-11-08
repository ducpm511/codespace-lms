import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface LearnNavItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Số nhỏ cạnh nhãn (vd. bài tập còn phải làm); bỏ trống thì không hiện. */
  badge?: string;
}

/** Vạch kích hoạt: section nào chứa điểm cách mép trên viewport ~1/3 chiều cao thì là section đang xem. */
const ACTIVATION_RATIO = 0.3;

/**
 * Section đang xem khi cuộn. Đo trực tiếp vị trí các section ở mỗi lần cuộn (rAF) thay vì IntersectionObserver,
 * vì section dài hơn màn hình (danh sách bài học) không bao giờ "giao" đủ một ngưỡng cố định.
 */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join('|');

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * ACTIVATION_RATIO;
      let current: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // Cuộn chạm đáy: section cuối có thể quá ngắn để vượt vạch, vẫn phải được chọn.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && ids.length > 0) current = ids[ids.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` là bản rút gọn ổn định của `ids`
  }, [key]);

  return active;
}

/**
 * Mục lục của trang Học tập. Desktop (≥ lg): cột trái dính khi cuộn. Điện thoại/tablet: thanh chip ngang dính
 * dưới header, tự cuộn ngang bên trong (trang không cuộn ngang) và đưa chip đang chọn vào giữa.
 */
export function LearnSectionNav({ items }: { items: LearnNavItem[] }): JSX.Element {
  const { t } = useTranslation();
  const active = useActiveSection(items.map((i) => i.id));
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !active) return;
    const chip = strip.querySelector<HTMLElement>(`[data-nav="${active}"]`);
    // Chỉ cuộn khi thanh đang tràn (chế độ chip ngang); ở cột dọc desktop thì không có gì để cuộn.
    if (!chip || strip.scrollWidth <= strip.clientWidth) return;
    // Đo theo khung của chính thanh (offsetLeft tính từ nav nên lệch phần padding).
    const offset = chip.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    strip.scrollTo({ left: offset - (strip.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav
      aria-label={t('learn.navLabel')}
      className="learn-nav sticky top-14 z-30 -mx-4 -mt-8 px-4 py-2 lg:top-20 lg:mx-0 lg:mt-0 lg:self-start lg:p-0"
    >
      <p className="text-muted mb-2 hidden px-3 text-[11px] uppercase tracking-[0.08em] lg:block">{t('learn.navTitle')}</p>
      <div ref={stripRef} className="learn-nav-strip flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              data-nav={item.id}
              onClick={() => go(item.id)}
              aria-current={isActive ? 'location' : undefined}
              className={`learn-nav-item cx-press ${isActive ? 'learn-nav-item-active' : ''}`}
            >
              <i className={`${isActive ? 'ph-fill' : 'ph'} ${item.icon} text-base`} style={{ color: item.color }} aria-hidden />
              <span className="truncate">{item.label}</span>
              {item.badge && <span className="tag tag-neutral learn-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
