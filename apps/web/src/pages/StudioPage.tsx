import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BLOCKSPACE_EDITOR_URL, useBlockSpace } from '../features/studio/useBlockSpace';
import { PillButton } from './teach/teachUi';

/**
 * SPIKE T11.1 — BlockSpace nhúng trong LMS. Chưa có backend (T11.3): "Lưu" tải file .sb3 về máy,
 * "Mở" đọc .sb3 từ máy. Mục đích: chứng minh nạp/lưu qua postMessage chạy được và đo tải trang.
 */
export function StudioPage(): JSX.Element {
  const { t } = useTranslation();
  const { iframeRef, state, load, loadDefault, save } = useBlockSpace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const loadedDefault = useRef(false);

  // Dự án đầu tiên = Rex, không phải Mèo mặc định của bundle gốc.
  useEffect(() => {
    if (state.ready && !loadedDefault.current) {
      loadedDefault.current = true;
      void loadDefault(t('studio.defaultTitle'));
    }
  }, [state.ready, loadDefault, t]);

  // Cảnh báo khi rời trang còn thay đổi chưa lưu.
  useEffect(() => {
    if (!state.dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.dirty]);

  const download = async () => {
    setBusy(true);
    try {
      const { sb3, title } = await save();
      const url = URL.createObjectURL(new Blob([sb3], { type: 'application/x.scratch.sb3' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'BlockSpace'}.sb3`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Toàn màn hình (route nằm ngoài AppLayout): vùng lập trình Scratch cần mọi pixel chiều ngang.
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
        style={{ borderColor: 'var(--color-divider)', background: 'var(--color-surface)' }}
      >
        <Link to="/learn" className="btn btn-ghost cx-press" title={t('studio.back')}>
          <i className="ph ph-arrow-left" aria-hidden />
          <span className="hidden sm:inline">{t('studio.back')}</span>
        </Link>
        <h1 className="cx-display m-0 flex items-center gap-2" style={{ fontSize: 17 }}>
          BlockSpace <span className="tag tag-outline">{t('studio.spikeTag')}</span>
        </h1>
        <span className="text-muted ml-auto hidden truncate text-xs md:inline">
          {!state.ready ? t('studio.loading') : state.dirty ? t('studio.unsaved') : t('studio.saved')}
          {state.readyMs !== null && ` · ${t('studio.readyIn', { seconds: (state.readyMs / 1000).toFixed(1) })}`}
        </span>
        <div className="ml-auto flex items-center gap-2 md:ml-2">
          <PillButton
            variant="secondary"
            icon="ph-sparkle"
            disabled={!state.ready}
            onClick={() => void loadDefault(t('studio.defaultTitle'))}
          >
            {t('studio.newProject')}
          </PillButton>
          <PillButton
            variant="secondary"
            icon="ph-folder-open"
            disabled={!state.ready}
            onClick={() => fileRef.current?.click()}
          >
            {t('studio.openFile')}
          </PillButton>
          <PillButton icon="ph-download-simple" disabled={!state.ready || busy} onClick={() => void download()}>
            {t('studio.saveFile')}
          </PillButton>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".sb3"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) load(await f.arrayBuffer(), f.name.replace(/\.sb3$/i, ''));
          }}
        />
      </header>
      {state.error && (
        <p className="m-0 px-3 py-1 text-sm" style={{ color: '#f4a3a3' }}>
          {state.error}
        </p>
      )}
      <iframe
        ref={iframeRef}
        src={BLOCKSPACE_EDITOR_URL}
        title="BlockSpace"
        className="w-full min-h-0 flex-1"
        style={{ border: 0, background: '#fff' }}
        allow="microphone; camera; fullscreen"
      />
    </div>
  );
}
