import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudentOwnGradebook } from '../../features/gradebook/hooks';
import { useMyCertificates } from '../../features/certificates/hooks';
import { IconTile } from './IconTile';
import { EXERCISE_KIND_META, groupGradebook, type GradeGroup } from './learnGroups';

/** Số dòng mỗi nhóm hiện sẵn khi mở; còn lại sau "Xem thêm". */
const ROW_LIMIT = 8;

/**
 * Kết quả học tập & chứng chỉ của học viên. Tóm tắt trước (tổng điểm, tiến độ, số bài có điểm, chứng chỉ),
 * chi tiết từng bài gom theo loại và thu gọn sẵn, mở ra mới thấy bảng điểm — không bỏ con số nào của sổ.
 */
export function StudentGradebookSection({ classId }: { classId: string | null }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const { data: gradebook, isLoading: loadingGrades } = useStudentOwnGradebook(classId);
  const { data: certificates, isLoading: loadingCerts } = useMyCertificates();
  const groups = useMemo(() => groupGradebook(gradebook), [gradebook]);

  if (!classId) return null;

  const scored = groups.reduce((s, g) => s + g.scored, 0);
  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  const validCerts = (certificates ?? []).filter((c) => !c.revokedAt).length;

  const stats = gradebook
    ? [
        { icon: 'ph-chart-line-up', color: 'var(--cx-purple)', value: `${gradebook.totalWeightedScore}%`, label: t('learn.gradesTotal') },
        { icon: 'ph-flag-checkered', color: 'var(--cx-teal)', value: `${gradebook.completionRate}%`, label: t('learn.gradesCompletion'), bar: gradebook.completionRate },
        { icon: 'ph-list-checks', color: 'var(--cx-amber)', value: `${scored}/${total}`, label: t('learn.gradesScoredCount') },
        { icon: 'ph-certificate', color: 'var(--cx-coral)', value: String(validCerts), label: t('learn.gradesCertCount') },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <IconTile icon="ph-trophy" color="var(--cx-amber)" size={40} />
        <div className="min-w-0">
          <h2 className="cx-display text-xl">{t('learn.gradesHeading')}</h2>
          <p className="text-muted text-xs">{t('learn.gradesSubtitle')}</p>
        </div>
      </div>

      {loadingGrades && <p className="text-muted text-sm">{t('learn.gradesLoading')}</p>}

      {stats.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {stats.map((s) => (
            <div key={s.label} className="card" style={{ borderRadius: 18, padding: 'var(--space-6)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2">
                <i className={`ph-fill ${s.icon}`} style={{ color: s.color, fontSize: 20 }} aria-hidden />
                <span className="text-muted text-xs">{s.label}</span>
              </div>
              <p className="cx-display" style={{ margin: 0, fontSize: 24, lineHeight: 1.1 }}>{s.value}</p>
              {s.bar !== undefined && (
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-neutral-800)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.bar)}%`, background: 'linear-gradient(90deg, var(--cx-teal), var(--cx-purple))' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loadingGrades && total === 0 && <p className="text-muted text-sm">{t('learn.gradesEmpty')}</p>}

      {groups.length > 0 && (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em]">{t('learn.gradesDetailHeading')}</p>
          {groups.map((g) => <GradeGroupCard key={g.type} group={g} />)}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <i className="ph-fill ph-certificate" style={{ color: 'var(--cx-purple)', fontSize: 20 }} aria-hidden />
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em]">{t('learn.certHeading')}</p>
        </div>
        {loadingCerts ? (
          <p className="text-muted text-sm">{t('learn.certLoading')}</p>
        ) : !certificates || certificates.length === 0 ? (
          <p className="text-muted text-sm">{t('learn.certEmpty')}</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="card cx-lift"
                style={{ borderRadius: 18, padding: 'var(--space-6)', borderTop: '3px solid color-mix(in srgb, var(--cx-purple) 35%, transparent)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <IconTile icon="ph-certificate" color="var(--cx-purple)" size={40} />
                  <span className={`tag ${cert.revokedAt ? 'tag-neutral' : 'tag-accent'}`}>
                    {cert.revokedAt ? t('gradebook.revoked') : t('gradebook.valid')}
                  </span>
                </div>
                <p className="card-title cx-display" style={{ width: '100%' }}>{cert.courseTitle}</p>
                <p className="card-meta font-mono" style={{ color: 'var(--color-accent-200)' }}>{cert.serialNo}</p>
                <div className="text-muted flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs" style={{ borderColor: 'var(--color-divider)' }}>
                  <span>{t('learn.certScore', { score: cert.finalScore })}</span>
                  <span>{t('learn.certIssuedAt', { date: new Date(cert.issuedAt).toLocaleDateString(i18n.language) })}</span>
                </div>
                <a
                  href={`/verify/${cert.verificationCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost cx-press self-end text-xs"
                >
                  <i className="ph ph-arrow-square-out" aria-hidden /> {t('learn.certVerify')}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GradeGroupCard({ group }: { group: GradeGroup }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const meta = EXERCISE_KIND_META[group.type];
  const rows = showAll ? group.rows : group.rows.slice(0, ROW_LIMIT);
  const overflow = group.rows.length - ROW_LIMIT;
  const panelId = `grade-group-${group.type}`;

  return (
    <div className="card" style={{ borderRadius: 18, padding: 0, borderLeft: `3px solid color-mix(in srgb, ${meta.color} 45%, transparent)` }}>
      <button
        type="button"
        className="cx-press flex w-full items-center gap-3 text-left"
        style={{ padding: 'var(--space-4) var(--space-6)' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <IconTile icon={meta.icon} color={meta.color} size={36} />
        <div className="min-w-0 flex-1">
          <p className="card-title cx-display" style={{ fontSize: 15 }}>{t(`learn.gradeType_${group.type}`)}</p>
          <p className="card-meta">
            {t('learn.gradeGroupScored', { scored: group.scored, total: group.rows.length })} ·{' '}
            {t('learn.gradeGroupPoints', { earned: group.earned, possible: group.possible })}
          </p>
        </div>
        <span className="text-muted hidden shrink-0 text-xs sm:inline">{open ? t('learn.gradesHide') : t('learn.gradesShow')}</span>
        <i className={`ph ${open ? 'ph-caret-up' : 'ph-caret-down'} shrink-0`} style={{ color: 'var(--color-accent)' }} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="border-t" style={{ borderColor: 'var(--color-divider)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('learn.gradeColItem')}</th>
                <th className="w-20 text-right">{t('learn.gradeColMax')}</th>
                <th className="w-28 text-right">{t('learn.gradeColScore')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="break-words">{r.title}</td>
                  <td className="text-muted text-right">{t('gradebook.scoreValue', { score: r.maxScore })}</td>
                  <td className="text-right">
                    {r.score !== null ? (
                      <span className="tag tag-accent">{t('gradebook.scoreValue', { score: r.score })}</span>
                    ) : (
                      <span className="text-muted text-xs">{t('learn.gradeNoScore')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {overflow > 0 && (
            <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
              <button type="button" className="btn btn-ghost cx-press" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t('learn.showLess') : t('learn.showMore', { count: overflow })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
