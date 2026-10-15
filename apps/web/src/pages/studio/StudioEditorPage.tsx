import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { BLOCKSPACE_EDITOR_URL, useBlockSpace } from '../../features/studio/useBlockSpace';
import { fetchProjectForEditor, fetchProjectFrom, pushProject } from '../../features/studio/projectSync';
import { getLatestProjectJson, getProject, getProjectAsset, getProjectVersionJson } from '../../features/studio/api';
import { useProject, useUpdateProject } from '../../features/studio/hooks';
import type { CollabClient } from '../../features/studio/collabClient';
import { useCollab, type CollabView } from '../../features/studio/useCollab';
import { PillButton } from '../teach/teachUi';

/** Tự lưu sau ngần này kể từ thay đổi đầu tiên chưa lưu (ADR D3: mở lại mất tối đa ~30 giây công việc). */
const AUTOSAVE_MS = 20_000;
/** Dưới bề ngang này vùng lập trình Scratch không dùng được (như bản gốc) — báo trước cho điện thoại. */
const MIN_EDITOR_WIDTH = 1024;

type SaveStatus =
  { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; message: string };

/** Trình soạn BlockSpace của MỘT dự án — toàn màn hình (route ngoài AppLayout). */
export function StudioEditorPage(): JSX.Element {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const project = useProject(id);
  const updateProject = useUpdateProject(id);
  const blockspace = useBlockSpace();
  const { iframeRef, state, load, loadDefault, save, open, reopen, exportProject, markSaved, changeSeq } = blockspace;

  const [opening, setOpening] = useState(true);
  const [openError, setOpenError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [narrowDismissed, setNarrowDismissed] = useState(false);
  const known = useRef(new Set<string>());
  const started = useRef(false);
  const saving = useRef<Promise<number | null> | null>(null);
  const saveAfterLoad = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const detail = project.data;
  /** Phiên bản đã nạp lúc mở — làm chung dùng để biết bản trên server có mới hơn không khi nối lại. */
  const [openedSeq, setOpenedSeq] = useState<number | null>(null);
  const titleRef = useRef<string | undefined>(undefined);
  titleRef.current = detail?.title;

  // Mở dự án một lần khi cả trình soạn lẫn thông tin dự án đã sẵn sàng.
  useEffect(() => {
    if (!state.ready || !detail?.canEdit || started.current) return;
    started.current = true;
    setOpenedSeq(detail.latestSeq);
    fetchProjectForEditor(id)
      .then((loaded) => {
        known.current = loaded.known;
        if (loaded.projectJson === null) loadDefault(detail.title);
        else open(loaded.projectJson, loaded.assets, detail.title);
      })
      .catch((e: unknown) => {
        setOpening(false);
        setOpenError(e instanceof Error ? e.message : String(e));
      });
  }, [state.ready, detail, id, loadDefault, open]);

  const collabClient = useRef<CollabClient | null>(null);

  /** Lưu thành phiên bản mới; trả seq phiên bản (null = lỗi, đã báo trên thanh trạng thái). */
  const saveNow = useCallback(
    (onExport?: () => void): Promise<number | null> => {
      if (saving.current) return saving.current;
      const run = (async () => {
        setStatus({ kind: 'saving' });
        try {
          const seq = changeSeq.current;
          onExport?.();
          const exported = await exportProject();
          const version = await pushProject(id, exported, known.current);
          const title = exported.title.trim().slice(0, SCRATCH_TITLE_MAX_LENGTH);
          if (title && detail && title !== detail.title) await updateProject.mutateAsync({ title });
          markSaved(seq);
          setStatus({ kind: 'saved', at: new Date() });
          collabClient.current?.saved(version.seq);
          return version.seq;
        } catch (e) {
          setStatus({ kind: 'error', message: e instanceof ApiError || e instanceof Error ? e.message : String(e) });
          return null;
        } finally {
          saving.current = null;
        }
      })();
      saving.current = run;
      return run;
    },
    [changeSeq, detail, exportProject, id, markSaved, updateProject],
  );

  // Làm chung (T11.6b): bật khi dự án có đồng tác giả, SAU khi dự án thật đã mở xong.
  const collabWanted = !!detail && detail.collaborators.length > 0 && state.ready && !opening && !openError;
  const { view: collab, client } = useCollab(
    id,
    collabWanted,
    blockspace,
    {
      reload: async (versionSeq) => {
        const loaded = await fetchProjectFrom({
          json: () => (versionSeq === null ? getLatestProjectJson(id) : getProjectVersionJson(id, versionSeq)),
          asset: (md5ext) => getProjectAsset(id, md5ext),
        });
        if (loaded.projectJson === null) return;
        for (const name of loaded.known) known.current.add(name);
        await reopen(loaded.projectJson, loaded.assets, titleRef.current);
      },
      snapshot: async (onExport) => {
        // Bản đang lưu dở được xuất TRƯỚC lời nhờ — chưa có các op mới nhất; đợi xong rồi lưu bản mới.
        if (saving.current) await saving.current;
        const seq = await saveNow(onExport);
        if (seq === null) throw new Error('save failed');
        return seq;
      },
      latestVersionSeq: async () => (await getProject(id)).latestSeq,
      remoteSaved: () => markSaved(changeSeq.current),
    },
    openedSeq,
  );
  collabClient.current = client.current;
  // Đang làm chung: chỉ người lưu chính tự lưu; khi chưa đồng bộ xong / mất mạng thì không ai lưu (bản đó có
  // thể cũ hơn của nhóm và ghi đè lên).
  const collabLive = collab?.phase === 'live';
  const canSave = !collab || collabLive;
  const autosaves = !collab || (collabLive && collab.lead);

  useEffect(() => {
    if (state.loadCount === 0) return;
    setOpening(false);
    // Vừa mở file .sb3 từ máy vào dự án này → lưu ngay thành phiên bản mới.
    if (saveAfterLoad.current) {
      saveAfterLoad.current = false;
      void saveNow();
    }
  }, [state.loadCount, saveNow]);

  // Tự lưu: có thay đổi chưa lưu ⇒ lưu sau AUTOSAVE_MS; ẩn tab (chuyển ứng dụng, khóa máy) ⇒ lưu ngay.
  useEffect(() => {
    if (!state.dirty || !autosaves) return undefined;
    const timer = window.setTimeout(() => void saveNow(), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void saveNow();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [state.dirty, saveNow, autosaves]);

  const leave = async (to: string) => {
    if (state.dirty && autosaves) await saveNow();
    navigate(to);
  };

  const download = async () => {
    const { sb3, title } = await save();
    const url = URL.createObjectURL(new Blob([sb3], { type: 'application/x.scratch.sb3' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'BlockSpace'}.sb3`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (project.error instanceof ApiError && project.error.status === 404) {
    return <CenteredMessage text={t('studio.notFound')} />;
  }
  // Xem được nhưng không sửa được (dự án bạn trong lớp) → trang xem.
  if (detail && !detail.canEdit) return <Navigate to={`/studio/${id}`} replace />;

  const statusText = !state.ready
    ? t('studio.loading')
    : opening
      ? t('studio.opening')
      : status.kind === 'saving'
        ? t('studio.saving')
        : status.kind === 'error'
          ? t('studio.saveFailed', { message: status.message })
          : collabLive && !autosaves
            ? t('studio.collab.leaderSaves')
            : state.dirty
              ? t('studio.unsaved')
              : status.kind === 'saved'
                ? t('studio.savedAt', {
                    time: status.at.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
                  })
                : t('studio.saved');
  const narrow = !narrowDismissed && window.innerWidth < MIN_EDITOR_WIDTH;

  return (
    // Toàn màn hình (route nằm ngoài AppLayout): vùng lập trình Scratch cần mọi pixel chiều ngang.
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
        style={{ borderColor: 'var(--color-divider)', background: 'var(--color-surface)' }}
      >
        <button type="button" className="btn btn-ghost cx-press" onClick={() => void leave('/studio')}>
          <i className="ph ph-arrow-left" aria-hidden />
          <span className="hidden sm:inline">{t('studio.myProjects')}</span>
        </button>
        <h1 className="cx-display m-0 min-w-0 truncate" style={{ fontSize: 17 }}>
          {detail?.title ?? 'BlockSpace'}
        </h1>
        {collab && collabLive && (
          <span className="tag tag-outline hidden md:inline-flex" title={collab.members.map((m) => m.name).join(', ')}>
            <i className="ph ph-users-three" aria-hidden /> {t('studio.collab.live', { count: collab.members.length })}
          </span>
        )}
        <span
          className={`ml-auto hidden truncate text-xs md:inline ${status.kind === 'error' ? '' : 'text-muted'}`}
          role="status"
          style={status.kind === 'error' ? { color: '#f4a3a3' } : undefined}
        >
          {statusText}
        </span>
        <div className="ml-auto flex items-center gap-2 md:ml-2">
          <PillButton variant="ghost" icon="ph-play" onClick={() => void leave(`/studio/${id}`)}>
            <span className="hidden lg:inline">{t('studio.viewProject')}</span>
          </PillButton>
          <PillButton
            variant="secondary"
            icon="ph-folder-open"
            // Mở file .sb3 thay cả dự án — khi làm chung sẽ đè lên việc của cả nhóm.
            disabled={!state.ready || opening || !!collab}
            onClick={() => fileRef.current?.click()}
          >
            <span className="hidden lg:inline">{t('studio.openFile')}</span>
          </PillButton>
          <PillButton
            variant="secondary"
            icon="ph-download-simple"
            disabled={!state.ready || opening}
            onClick={() => void download()}
          >
            <span className="hidden lg:inline">{t('studio.saveFile')}</span>
          </PillButton>
          <PillButton
            icon="ph-floppy-disk"
            disabled={!state.ready || opening || status.kind === 'saving' || !canSave}
            onClick={() => void saveNow()}
          >
            {t('studio.save')}
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
            if (!f) return;
            saveAfterLoad.current = true;
            load(await f.arrayBuffer());
          }}
        />
      </header>
      {(state.error || openError) && (
        <p className="m-0 px-3 py-1 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {openError ? t('studio.openFailed', { message: openError }) : state.error}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          src={BLOCKSPACE_EDITOR_URL}
          title="BlockSpace"
          className="h-full w-full"
          style={{ border: 0, background: '#fff' }}
          allow="microphone; camera; fullscreen"
        />
        {/* Che trình soạn tới khi dự án thật nạp xong: trước đó nó đang hiện dự án mặc định, sửa vào đó
            sẽ mất khi dự án của em nạp đè lên. */}
        {opening && !openError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'var(--color-bg)' }}
            aria-busy="true"
          >
            <img src="/brand/mascot-laptop.png" alt="" className="cx-float h-28 w-auto" />
            <p className="text-muted m-0 animate-pulse">{state.ready ? t('studio.opening') : t('studio.loading')}</p>
          </div>
        )}
        {collab && !collabLive && <CollabCover view={collab} projectId={id} />}
        {narrow && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
            style={{ background: 'color-mix(in srgb, var(--color-bg) 94%, transparent)' }}
          >
            <img src="/brand/mascot-huh.png" alt="" className="cx-bob h-28 w-auto" />
            <p className="cx-display m-0 max-w-sm text-lg">{t('studio.narrowTitle')}</p>
            <p className="text-muted m-0 max-w-sm text-sm">{t('studio.narrowHint')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to={`/studio/${id}`} className="btn btn-primary cx-press" style={{ borderRadius: 999 }}>
                <i className="ph ph-play" aria-hidden /> {t('studio.viewProject')}
              </Link>
              <PillButton variant="ghost" onClick={() => setNarrowDismissed(true)}>
                {t('studio.openAnyway')}
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Che trình soạn khi làm chung chưa sẵn sàng: đang nối / đang nạp trạng thái nhóm / mất mạng (ADR D5′: chỉ đọc
 * + tự nối lại, không sửa offline rồi gộp) / bị gỡ. Nửa trong suốt để vẫn thấy dự án phía sau.
 */
function CollabCover({ view, projectId }: { view: CollabView; projectId: string }): JSX.Element {
  const { t } = useTranslation();
  const ended = view.phase === 'ended';
  const text = ended
    ? view.endCode === 4009
      ? t('studio.collab.roomFull')
      : view.endCode === 4003
        ? t('studio.collab.removed')
        : t('studio.collab.ended')
    : view.phase === 'offline'
      ? t('studio.collab.offline')
      : view.phase === 'syncing'
        ? t('studio.collab.syncing')
        : t('studio.collab.connecting');
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ background: 'color-mix(in srgb, var(--color-bg) 82%, transparent)' }}
      aria-busy={!ended}
      role="status"
    >
      <img
        src={ended ? '/brand/mascot-huh.png' : '/brand/mascot-laptop.png'}
        alt=""
        className={`h-24 w-auto ${ended ? '' : 'cx-float'}`}
      />
      <p className={`cx-display m-0 max-w-sm text-lg ${ended ? '' : 'animate-pulse'}`}>{text}</p>
      {ended && (
        <Link to={`/studio/${projectId}`} className="btn btn-secondary cx-press" style={{ borderRadius: 999 }}>
          <i className="ph ph-play" aria-hidden /> {t('studio.viewProject')}
        </Link>
      )}
    </div>
  );
}

function CenteredMessage({ text }: { text: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <img src="/brand/mascot-huh.png" alt="" className="h-28 w-auto" />
      <p className="cx-display m-0 text-lg">{text}</p>
      <Link to="/studio" className="btn btn-secondary cx-press" style={{ borderRadius: 999 }}>
        {t('studio.myProjects')}
      </Link>
    </div>
  );
}
