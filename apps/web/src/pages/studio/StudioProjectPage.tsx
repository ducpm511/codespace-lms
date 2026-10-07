import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import { BLOCKSPACE_EDITOR_URL, useBlockSpace } from '../../features/studio/useBlockSpace';
import { fetchProjectForEditor } from '../../features/studio/projectSync';
import { useLikeProject, useProject, useRemixProject } from '../../features/studio/hooks';
import { ShareControl } from '../../features/studio/ShareControl';

/** Trang dự án: sân khấu + cờ xanh (trình soạn ở chế độ player). Ai xem được dự án đều vào được. */
export function StudioProjectPage(): JSX.Element {
  const { id = '' } = useParams();
  // key: đi từ dự án này sang dự án khác (vd nhãn "Remix từ…") phải dựng lại player, không dùng lại.
  return <ProjectView key={id} id={id} />;
}

function ProjectView({ id }: { id: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const like = useLikeProject(id);
  const remix = useRemixProject();
  const project = useProject(id);
  const { iframeRef, state, open } = useBlockSpace();
  const [content, setContent] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const started = useRef(false);
  const detail = project.data;

  useEffect(() => {
    if (!state.ready || !detail || started.current) return;
    started.current = true;
    fetchProjectForEditor(id)
      .then((loaded) => {
        if (loaded.projectJson === null) setContent('empty');
        else open(loaded.projectJson, loaded.assets, detail.title);
      })
      .catch(() => setContent('error'));
  }, [state.ready, detail, id, open]);

  useEffect(() => {
    if (state.loadCount > 0) setContent('ready');
  }, [state.loadCount]);

  if (project.isLoading) return <p className="text-muted m-0">{t('common.loading')}</p>;
  if (!detail) {
    const notFound = project.error instanceof ApiError && project.error.status === 404;
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <img src="/brand/mascot-huh.png" alt="" className="h-28 w-auto" />
        <p className="cx-display m-0 text-lg">{notFound ? t('studio.notFound') : project.error?.message}</p>
        <Link to="/studio" className="btn btn-secondary cx-press" style={{ borderRadius: 999 }}>
          {t('studio.myProjects')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-5">
      <Link to="/studio" className="btn btn-ghost cx-press self-start">
        <i className="ph ph-arrow-left" aria-hidden /> {t('studio.myProjects')}
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="cx-display m-0 break-words" style={{ fontSize: 30 }}>
            {detail.title}
          </h1>
          <p className="text-muted m-0 text-sm">
            {t('studio.byline', {
              name: detail.ownerName,
              date: new Date(detail.updatedAt).toLocaleDateString(i18n.language),
            })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="tag tag-outline">{t(`studio.visibility_${detail.visibility}`)}</span>
            {detail.remixOf && (
              <Link to={`/studio/${detail.remixOf.id}`} className="tag tag-neutral">
                {t('studio.remixOf', { title: detail.remixOf.title })}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary cx-press"
            style={{ borderRadius: 999 }}
            aria-pressed={detail.likedByMe}
            title={detail.likedByMe ? t('studio.unlike') : t('studio.like')}
            disabled={like.isPending}
            onClick={() => like.mutate(!detail.likedByMe)}
          >
            <i
              className={`ph${detail.likedByMe ? '-fill' : ''} ph-heart`}
              style={detail.likedByMe ? { color: 'var(--cx-coral)' } : undefined}
              aria-hidden
            />
            {detail.likeCount}
          </button>
          {content === 'ready' && (
            <button
              type="button"
              className="btn btn-secondary cx-press"
              style={{ borderRadius: 999 }}
              disabled={remix.isPending}
              onClick={() => remix.mutate(id, { onSuccess: (copy) => navigate(`/studio/${copy.id}/edit`) })}
            >
              <i className="ph ph-git-fork" aria-hidden /> {t('studio.remix')}
            </button>
          )}
          {detail.canEdit && (
            <Link to={`/studio/${id}/edit`} className="btn btn-primary cx-press" style={{ borderRadius: 999 }}>
              <i className="ph ph-pencil-simple" aria-hidden /> {t('studio.openEditor')}
            </Link>
          )}
        </div>
      </div>
      {(remix.error || like.error) && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {(remix.error ?? like.error)?.message}
        </p>
      )}

      {/* Player Scratch có cỡ CỐ ĐỊNH: sân khấu 482×362 (480×360 + viền) + thanh cờ xanh 44px. Khung to hơn
          chỉ thêm dải xám thừa; màn hình nhỏ hơn dùng nút toàn màn hình của player. */}
      <div
        className="relative mx-auto overflow-hidden"
        style={{ width: 482, maxWidth: '100%', height: 406, borderRadius: 14, background: '#fff' }}
      >
        <iframe
          ref={iframeRef}
          src={`${BLOCKSPACE_EDITOR_URL}?mode=player`}
          title={detail.title}
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

      {detail.isOwner && (
        <section className="card mx-auto flex w-full flex-col gap-3 p-5" style={{ maxWidth: 482, borderRadius: 18 }}>
          <h2 className="cx-display m-0 flex items-center gap-2 text-lg">
            <i className="ph ph-share-network" style={{ color: 'var(--cx-teal)' }} aria-hidden />
            {t('studio.share.title')}
          </h2>
          <ShareControl project={detail} />
        </section>
      )}
    </div>
  );
}
