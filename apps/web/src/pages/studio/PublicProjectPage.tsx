import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import { useMe } from '../../features/auth/hooks';
import { getPublicAsset, getPublicProject, getPublicProjectJson, remixPublic } from '../../features/studio/api';
import { ReportControl } from '../../features/studio/ReportControl';
import { ScratchPlayer } from '../../features/studio/ScratchPlayer';

/**
 * Trang công khai `/p/<slug>` — ai có link cũng xem được, KHÔNG cần đăng nhập (ADR D4′). Chỉ có player,
 * tên dự án, biệt danh (không họ tên / lớp / trường). Remix + báo cáo cần đăng nhập. Không bình luận.
 */
export function PublicProjectPage(): JSX.Element {
  const { slug = '' } = useParams();
  return <PublicView key={slug} slug={slug} />;
}

function PublicView({ slug }: { slug: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const loggedIn = Boolean(me.data);
  const project = useQuery({ queryKey: ['scratch-public', slug], queryFn: () => getPublicProject(slug), retry: false });
  const remix = useMutation({
    mutationFn: () => remixPublic(slug),
    onSuccess: (copy) => navigate(`/studio/${copy.id}/edit`),
  });
  const source = useMemo(
    () => ({ json: () => getPublicProjectJson(slug), asset: (md5ext: string) => getPublicAsset(slug, md5ext) }),
    [slug],
  );
  const loginHref = `/login?next=${encodeURIComponent(`/p/${slug}`)}`;

  // Dự án của trẻ em: "ai có link" chứ KHÔNG để công cụ tìm kiếm lập chỉ mục / gợi ý ra.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  const data = project.data;

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      <header
        className="flex h-14 items-center gap-3 border-b px-4"
        style={{ borderColor: 'var(--color-divider)', background: 'var(--color-surface)' }}
      >
        <img src="/brand/logo-horizontal-white.png" alt="CodeSpace" className="h-[24px] w-auto" />
        <span className="cx-display text-lg">BlockSpace</span>
        <span className="ml-auto">
          {loggedIn ? (
            <Link to="/studio" className="btn btn-ghost cx-press">
              {t('studio.myProjects')}
            </Link>
          ) : (
            <Link to={loginHref} className="btn btn-secondary cx-press" style={{ borderRadius: 999 }}>
              {t('studio.public.login')}
            </Link>
          )}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 p-4 sm:p-6">
        {project.isLoading ? (
          <p className="text-muted m-0">{t('common.loading')}</p>
        ) : !data ? (
          <div className="flex flex-col items-center gap-4 p-10 text-center">
            <img src="/brand/mascot-huh.png" alt="" className="h-28 w-auto" />
            <p className="cx-display m-0 text-lg">
              {project.error instanceof ApiError && project.error.status === 404
                ? t('studio.public.notFound')
                : project.error?.message}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="cx-display m-0 break-words" style={{ fontSize: 30 }}>
                {data.title}
              </h1>
              <p className="text-muted m-0 text-sm">
                {t('studio.public.byline', {
                  name: data.nickname,
                  date: new Date(data.publishedAt).toLocaleDateString(i18n.language),
                })}
              </p>
            </div>
            <ScratchPlayer source={source} title={data.title} />
            <div className="flex flex-wrap items-center gap-2">
              {loggedIn ? (
                <button
                  type="button"
                  className="btn btn-primary cx-press"
                  style={{ borderRadius: 999 }}
                  disabled={remix.isPending}
                  onClick={() => remix.mutate()}
                >
                  <i className="ph ph-git-fork" aria-hidden /> {t('studio.public.remix')}
                </button>
              ) : (
                <Link to={loginHref} className="btn btn-primary cx-press" style={{ borderRadius: 999 }}>
                  <i className="ph ph-git-fork" aria-hidden /> {t('studio.public.loginToRemix')}
                </Link>
              )}
            </div>
            {remix.error && (
              <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
                {remix.error.message}
              </p>
            )}
            {loggedIn && <ReportControl target={{ slug }} />}
          </>
        )}
      </main>
    </div>
  );
}
