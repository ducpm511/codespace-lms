import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ScratchProjectSummaryDto } from '@lms/contracts';
import { useMe } from '../../features/auth/hooks';
import { useCreateProject, useDeleteProject, useMyProjects } from '../../features/studio/hooks';
import { useConfirm } from '../../components/useConfirm';
import { PillButton } from '../teach/teachUi';

/** "Dự án của tôi" — dự án BlockSpace mình làm chủ hoặc là đồng tác giả. */
export function StudioHome(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useMyProjects();
  const create = useCreateProject();

  const newProject = () =>
    create.mutate({ title: t('studio.defaultTitle') }, { onSuccess: (p) => navigate(`/studio/${p.id}/edit`) });

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <section
        className="cx-dots relative flex flex-wrap items-center gap-6 overflow-hidden p-6"
        style={{
          borderRadius: 'var(--cx-radius)',
          background: 'linear-gradient(140deg, var(--color-section), var(--color-section-glow))',
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="cx-display m-0" style={{ fontSize: 32 }}>
            BlockSpace
          </h1>
          <p className="m-0 max-w-lg" style={{ opacity: 0.85 }}>
            {t('studio.tagline')}
          </p>
          <div className="mt-2">
            <PillButton icon="ph-plus" disabled={create.isPending} onClick={newProject}>
              {t('studio.newProject')}
            </PillButton>
          </div>
        </div>
        <img src="/brand/mascot-laptop.png" alt="" className="cx-float h-32 w-auto" />
      </section>

      {create.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {create.error.message}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="cx-display m-0 flex items-center gap-2 text-xl">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--cx-purple) 20%, transparent)' }}
          >
            <i className="ph ph-puzzle-piece" style={{ color: 'var(--cx-purple)' }} aria-hidden />
          </span>
          {t('studio.myProjects')}
        </h2>

        {projects.isLoading ? (
          <p className="text-muted m-0">{t('common.loading')}</p>
        ) : projects.error ? (
          <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
            {projects.error.message}
          </p>
        ) : projects.data?.length ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {projects.data.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <img src="/brand/mascot-default.png" alt="" className="cx-bob h-24 w-auto" />
            <p className="cx-display m-0 text-lg">{t('studio.emptyTitle')}</p>
            <p className="text-muted m-0 text-sm">{t('studio.emptyHint')}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: ScratchProjectSummaryDto }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const confirm = useConfirm();
  const del = useDeleteProject();
  const isOwner = me?.id === project.ownerId;

  const remove = async () => {
    if (await confirm(t('studio.confirmDelete', { title: project.title }))) del.mutate(project.id);
  };

  return (
    <div
      className="card cx-tile flex flex-col gap-3 p-5"
      style={{ borderRadius: 18, boxShadow: 'inset 0 3px 0 color-mix(in srgb, var(--cx-purple) 30%, transparent)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--cx-purple) 20%, transparent)' }}
        >
          <i className="ph ph-puzzle-piece text-xl" style={{ color: 'var(--cx-purple)' }} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="card-title cx-display m-0 break-words">{project.title}</span>
          <span className="text-muted text-xs">
            {t('studio.updatedAt', { date: new Date(project.updatedAt).toLocaleDateString(i18n.language) })}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="tag tag-outline">{t(`studio.visibility_${project.visibility}`)}</span>
        {!isOwner && <span className="tag tag-neutral">{t('studio.coAuthor')}</span>}
        {project.latestSeq === null && <span className="tag tag-neutral">{t('studio.empty')}</span>}
      </div>
      <div className="mt-auto flex items-center gap-2">
        <Link
          to={`/studio/${project.id}/edit`}
          className="btn btn-primary btn-block cx-press"
          style={{ borderRadius: 999 }}
        >
          <i className="ph ph-pencil-simple" aria-hidden /> {t('studio.open')}
        </Link>
        <Link
          to={`/studio/${project.id}`}
          className="btn btn-icon btn-secondary cx-press"
          title={t('studio.viewProject')}
          aria-label={t('studio.viewProject')}
        >
          <i className="ph ph-play" aria-hidden />
        </Link>
        {isOwner && (
          <button
            type="button"
            className="btn btn-icon btn-secondary cx-press"
            title={t('studio.delete')}
            aria-label={t('studio.delete')}
            disabled={del.isPending}
            onClick={() => void remove()}
          >
            <i className="ph ph-trash" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
