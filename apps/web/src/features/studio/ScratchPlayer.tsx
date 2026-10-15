import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BLOCKSPACE_EDITOR_URL, useBlockSpace } from './useBlockSpace';
import { fetchProjectFrom, type ProjectSource } from './projectSync';

/**
 * Sân khấu + cờ xanh (trình soạn ở chế độ player) nạp từ một nguồn: dự án của tôi, bản công khai hay
 * bản chờ duyệt. Dựng lại khi đổi nguồn: truyền `key` khác cho component (vd id/slug).
 */
export function ScratchPlayer({
  source,
  title,
  onReady,
}: {
  source: ProjectSource;
  title: string;
  /** Gọi khi dự án đã nạp xong (vd mới hiện nút Remix). */
  onReady?: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { iframeRef, state, open } = useBlockSpace();
  const [content, setContent] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const started = useRef(false);

  useEffect(() => {
    if (!state.ready || started.current) return;
    started.current = true;
    fetchProjectFrom(source)
      .then((loaded) => {
        if (loaded.projectJson === null) setContent('empty');
        else open(loaded.projectJson, loaded.assets, title);
      })
      .catch(() => setContent('error'));
  }, [state.ready, source, title, open]);

  useEffect(() => {
    if (state.loadCount > 0) {
      setContent('ready');
      onReady?.();
    }
  }, [state.loadCount, onReady]);

  return (
    // Player Scratch có cỡ CỐ ĐỊNH: sân khấu 482×362 (480×360 + viền) + thanh cờ xanh 44px. Khung to hơn chỉ
    // thêm dải xám thừa; màn hình nhỏ hơn dùng nút toàn màn hình của player.
    <div
      className="relative mx-auto overflow-hidden"
      style={{ width: 482, maxWidth: '100%', height: 406, borderRadius: 14, background: '#fff' }}
    >
      <iframe
        ref={iframeRef}
        src={`${BLOCKSPACE_EDITOR_URL}?mode=player`}
        title={title}
        className="h-full w-full"
        style={{ border: 0 }}
        allow="fullscreen"
      />
      {content !== 'ready' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
          style={{ background: 'var(--color-surface)' }}
        >
          {content === 'loading' ? (
            <p className="text-muted m-0">{t('common.loading')}</p>
          ) : (
            <>
              <img src="/brand/mascot-huh.png" alt="" className="h-24 w-auto" />
              <p className="m-0">{content === 'empty' ? t('studio.noContent') : t('studio.playFailed')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
