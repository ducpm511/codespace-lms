import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ScratchModerationPublicationItem, ScratchModerationReportItem } from '@lms/contracts';
import { getRequestedAsset, getRequestedJson } from '../../features/studio/api';
import { useModerationActions, useModerationQueue } from '../../features/studio/hooks';
import { ScratchPlayer } from '../../features/studio/ScratchPlayer';
import { useConfirm } from '../../components/useConfirm';
import { PillButton } from '../teach/teachUi';

/**
 * Hàng chờ kiểm duyệt BlockSpace — GV thấy học viên các lớp mình dạy, admin thấy cả trường (backend lọc).
 * Duyệt công khai (xem trước đúng bản xin duyệt), biệt danh, báo cáo.
 */
export function StudioModerationPage(): JSX.Element {
  const { t } = useTranslation();
  const queue = useModerationQueue();
  const q = queue.data;

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <Link to="/studio" className="btn btn-ghost cx-press self-start">
        <i className="ph ph-arrow-left" aria-hidden /> BlockSpace
      </Link>
      <h1 className="cx-display m-0" style={{ fontSize: 30 }}>
        {t('studio.mod.title')}
      </h1>
      {queue.isLoading && <p className="text-muted m-0">{t('common.loading')}</p>}
      {queue.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {queue.error.message}
        </p>
      )}
      {q && (
        <>
          <Section icon="ph-globe-hemisphere-east" title={t('studio.mod.publications')} count={q.publications.length}>
            {q.publications.map((p) => (
              <PublicationRow key={p.projectId} item={p} />
            ))}
          </Section>
          <Section icon="ph-flag" title={t('studio.mod.reports')} count={q.reports.length}>
            {q.reports.map((r) => (
              <ReportRow key={r.id} item={r} />
            ))}
          </Section>
          <Section icon="ph-identification-badge" title={t('studio.mod.nicknames')} count={q.nicknames.length}>
            {q.nicknames.map((n) => (
              <NicknameRow key={n.userId} userId={n.userId} fullName={n.fullName} pending={n.pending} />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: string;
  title: string;
  count: number;
  children: React.ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="cx-display m-0 flex items-center gap-2 text-xl">
        <i className={`ph ${icon}`} style={{ color: 'var(--cx-amber)' }} aria-hidden /> {title}
        <span className="tag tag-neutral">{count}</span>
      </h2>
      {count === 0 ? <p className="text-muted m-0 text-sm">{t('studio.mod.empty')}</p> : children}
    </section>
  );
}

function PublicationRow({ item }: { item: ScratchModerationPublicationItem }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { publication } = useModerationActions();
  const [preview, setPreview] = useState(false);
  const [note, setNote] = useState('');
  const source = useMemo(
    () => ({
      json: () => getRequestedJson(item.projectId),
      asset: (md5ext: string) => getRequestedAsset(item.projectId, md5ext),
    }),
    [item.projectId],
  );
  const busy = publication.isPending;

  return (
    <div className="card flex flex-col gap-3 p-5" style={{ borderRadius: 18 }}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="card-title cx-display m-0 break-words">{item.title}</span>
          <span className="text-muted text-xs">
            {t('studio.mod.requestedBy', {
              name: item.ownerName,
              date: new Date(item.requestedAt).toLocaleString(i18n.language),
            })}
          </span>
          <span className="text-sm">
            {t('studio.mod.nicknameShown')}: <strong>{item.nickname ?? '—'}</strong>
            {item.nicknameIsNew && <span className="tag tag-outline ml-2">{t('studio.mod.newNickname')}</span>}
            {item.alreadyPublished && <span className="tag tag-neutral ml-2">{t('studio.mod.update')}</span>}
          </span>
        </div>
        <PillButton
          variant="secondary"
          icon={preview ? 'ph-eye-slash' : 'ph-play'}
          onClick={() => setPreview(!preview)}
        >
          {preview ? t('studio.mod.hide') : t('studio.mod.preview')}
        </PillButton>
      </div>
      {preview && <ScratchPlayer source={source} title={item.title} />}
      <input
        className="input"
        maxLength={300}
        placeholder={t('studio.mod.notePlaceholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <PillButton
          icon="ph-check"
          disabled={busy}
          onClick={() => publication.mutate({ projectId: item.projectId, decision: 'approve' })}
        >
          {t('studio.mod.approve')}
        </PillButton>
        <PillButton
          variant="secondary"
          icon="ph-x"
          disabled={busy}
          onClick={() =>
            publication.mutate({ projectId: item.projectId, decision: 'reject', note: note.trim() || undefined })
          }
        >
          {t('studio.mod.reject')}
        </PillButton>
      </div>
      {publication.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {publication.error.message}
        </p>
      )}
    </div>
  );
}

function ReportRow({ item }: { item: ScratchModerationReportItem }): JSX.Element {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const { report } = useModerationActions();
  const remove = async () => {
    if (
      await confirm({
        message: t('studio.mod.confirmRemove', { title: item.projectTitle }),
        confirmLabel: t('studio.mod.remove'),
      })
    ) {
      report.mutate({ id: item.id, action: 'remove' });
    }
  };
  return (
    <div className="card flex flex-col gap-2 p-5" style={{ borderRadius: 18 }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="card-title cx-display m-0">{item.projectTitle}</span>
        <span className="tag tag-outline">{t(`studio.report.reason_${item.reason}`)}</span>
        {item.isPublic && <span className="tag tag-accent">{t('studio.publish.live')}</span>}
      </div>
      <span className="text-muted text-xs">
        {t('studio.mod.reportedBy', {
          owner: item.ownerName,
          reporter: item.reporterName,
          date: new Date(item.createdAt).toLocaleString(i18n.language),
        })}
      </span>
      {item.note && <p className="m-0 text-sm">“{item.note}”</p>}
      <div className="flex flex-wrap gap-2">
        <Link
          to={item.publicSlug ? `/p/${item.publicSlug}` : `/studio/${item.projectId}`}
          target="_blank"
          className="btn btn-secondary cx-press"
          style={{ borderRadius: 999 }}
        >
          <i className="ph ph-play" aria-hidden /> {t('studio.mod.preview')}
        </Link>
        <PillButton
          variant="secondary"
          icon="ph-check"
          disabled={report.isPending}
          onClick={() => report.mutate({ id: item.id, action: 'dismiss' })}
        >
          {t('studio.mod.dismiss')}
        </PillButton>
        <PillButton icon="ph-eye-slash" disabled={report.isPending} onClick={() => void remove()}>
          {t('studio.mod.remove')}
        </PillButton>
      </div>
      {report.error && (
        <p className="m-0 text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {report.error.message}
        </p>
      )}
    </div>
  );
}

function NicknameRow({
  userId,
  fullName,
  pending,
}: {
  userId: string;
  fullName: string;
  pending: string;
}): JSX.Element {
  const { t } = useTranslation();
  const { nickname } = useModerationActions();
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4" style={{ borderRadius: 18 }}>
      <span className="min-w-0 flex-1 text-sm">
        {fullName} → <strong>{pending}</strong>
      </span>
      <PillButton
        icon="ph-check"
        disabled={nickname.isPending}
        onClick={() => nickname.mutate({ userId, decision: 'approve' })}
      >
        {t('studio.mod.approve')}
      </PillButton>
      <PillButton
        variant="secondary"
        icon="ph-x"
        disabled={nickname.isPending}
        onClick={() => nickname.mutate({ userId, decision: 'reject' })}
      >
        {t('studio.mod.reject')}
      </PillButton>
    </div>
  );
}
