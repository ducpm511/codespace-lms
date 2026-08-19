import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassSummary } from '@lms/contracts';
import { useClasses, useClass } from '../../features/classes/hooks';
import { useClassGradebook } from '../../features/gradebook/hooks';
import {
  useClassCertificates,
  useCertificateTemplates,
  useIssueCertificate,
  useRevokeCertificate,
} from '../../features/certificates/hooks';
import { DetailColumn, DetailHeader, DetailSection, EmptyHint, PillButton } from './teachUi';

const ERROR_COLOR = '#f4a3a3';

/** Icon + màu theo nguồn điểm (assignment / quiz / coding). */
const SOURCE_META: Record<string, { icon: string; color: string }> = {
  assignment: { icon: 'ph-clipboard-text', color: 'var(--cx-blue)' },
  quiz: { icon: 'ph-list-checks', color: 'var(--cx-teal)' },
  coding: { icon: 'ph-code', color: 'var(--cx-amber)' },
};
const sourceMeta = (s: string) => SOURCE_META[s] ?? { icon: 'ph-dot', color: 'var(--cx-purple)' };

export function TeachGradebook(): JSX.Element {
  const { t } = useTranslation();
  const { data: classesData, isLoading: loadingClasses } = useClasses();
  const classes: ClassSummary[] = classesData?.items || [];

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const activeClassId = selectedClassId || (classes.length > 0 ? classes[0].id : null);

  const { data: classDetail } = useClass(activeClassId);
  const { data: gradebook, isLoading: loadingGradebook } = useClassGradebook(activeClassId);
  const { data: certificates, isLoading: loadingCertificates } = useClassCertificates(activeClassId);
  const { data: templates } = useCertificateTemplates();

  const issueMutation = useIssueCertificate(activeClassId);
  const revokeMutation = useRevokeCertificate(activeClassId);

  // Issue modal state
  const [issueModalUser, setIssueModalUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [issueError, setIssueError] = useState<string | null>(null);

  // Revoke modal state
  const [revokeCertId, setRevokeCertId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const courseId = classDetail?.courses && classDetail.courses.length > 0 ? classDetail.courses[0].courseId : null;
  const activeClassName = classes.find((c) => c.id === activeClassId)?.name ?? '';

  const handleIssue = async () => {
    if (!issueModalUser || !courseId || !activeClassId) return;
    const tId = selectedTemplateId || (templates && templates.length > 0 ? templates[0].id : 'std-template');
    setIssueError(null);
    try {
      await issueMutation.mutateAsync({
        userId: issueModalUser.id,
        courseId,
        classId: activeClassId,
        templateId: tId,
      });
      setIssueModalUser(null);
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : t('gradebook.issueError'));
    }
  };

  const handleRevoke = async () => {
    if (!revokeCertId || !revokeReason.trim()) return;
    setRevokeError(null);
    try {
      await revokeMutation.mutateAsync({ id: revokeCertId, data: { reason: revokeReason.trim() } });
      setRevokeCertId(null);
      setRevokeReason('');
    } catch (err: unknown) {
      setRevokeError(err instanceof Error ? err.message : t('gradebook.revokeError'));
    }
  };

  if (loadingClasses) return <p className="text-muted text-sm">{t('common.loading')}</p>;

  return (
    <DetailColumn>
      <DetailHeader
        icon="ph-trophy"
        color="var(--cx-amber)"
        title={t('teach.tab_gradebook')}
        meta={t('gradebook.subtitle')}
        actions={
          <div className="field" style={{ minWidth: 220 }}>
            <label>{t('gradebook.pickClass')}</label>
            <select className="input" value={activeClassId || ''} onChange={(e) => setSelectedClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        }
      />

      {loadingGradebook ? (
        <p className="text-muted text-sm">{t('gradebook.loading')}</p>
      ) : !gradebook ? (
        <EmptyHint icon="ph-table">{t('gradebook.pickClassHint')}</EmptyHint>
      ) : (
        <>
          <DetailSection
            icon="ph-table"
            color="var(--cx-purple)"
            title={t('gradebook.tableHeading', { name: activeClassName })}
            count={t('gradebook.rowCount', { count: gradebook.rows.length })}
          >
            <div className="card" style={{ borderRadius: 20, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>{t('gradebook.colStudent')}</th>
                      {gradebook.items.map((item) => {
                        const meta = sourceMeta(item.sourceType);
                        return (
                          <th key={item.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className="flex items-center justify-center gap-1.5">
                              <i className={`ph-fill ${meta.icon}`} style={{ color: meta.color }} aria-hidden />
                              {item.title}
                            </span>
                            <span className="text-muted block" style={{ fontSize: 10, fontWeight: 400 }}>
                              {t('gradebook.maxScore', { score: item.maxScore })}
                            </span>
                          </th>
                        );
                      })}
                      <th style={{ textAlign: 'center' }}>{t('gradebook.colTotal')}</th>
                      <th style={{ textAlign: 'center' }}>{t('gradebook.colCompletion')}</th>
                      <th style={{ textAlign: 'center' }}>{t('gradebook.colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.rows.length === 0 ? (
                      <tr>
                        <td colSpan={gradebook.items.length + 4} className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-7)' }}>
                          {t('gradebook.noStudents')}
                        </td>
                      </tr>
                    ) : (
                      gradebook.rows.map((row) => {
                        const hasCert = certificates?.some((c) => c.userId === row.userId && !c.revokedAt);
                        return (
                          <tr key={row.userId}>
                            <td>
                              <span className="block" style={{ fontSize: 13 }}>
                                {row.userFullName}
                              </span>
                              <span className="text-muted block" style={{ fontSize: 11 }}>
                                {row.userEmail}
                              </span>
                            </td>

                            {gradebook.items.map((item) => {
                              const score = row.grades[item.id];
                              return (
                                <td key={item.id} style={{ textAlign: 'center' }}>
                                  {score !== null && score !== undefined ? (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        borderRadius: 999,
                                        padding: '3px 10px',
                                        fontSize: 11,
                                        background: 'var(--color-accent-800)',
                                        color: 'var(--color-accent-100)',
                                      }}
                                    >
                                      {t('gradebook.scoreValue', { score })}
                                    </span>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                              );
                            })}

                            <td style={{ textAlign: 'center' }}>
                              <span className="cx-display" style={{ color: 'var(--cx-amber)', fontSize: 15 }}>
                                {row.totalWeightedScore}%
                              </span>
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  borderRadius: 999,
                                  padding: '3px 10px',
                                  fontSize: 11,
                                  color: 'var(--cx-teal)',
                                  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--cx-teal) 45%, transparent)',
                                }}
                              >
                                {row.completionRate}%
                              </span>
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              {hasCert ? (
                                <span className="tag tag-accent">
                                  <i className="ph-fill ph-seal-check" aria-hidden /> {t('gradebook.issued')}
                                </span>
                              ) : (
                                <PillButton
                                  icon="ph-certificate"
                                  onClick={() => {
                                    setIssueError(null);
                                    setIssueModalUser({ id: row.userId, name: row.userFullName });
                                  }}
                                >
                                  {t('gradebook.issue')}
                                </PillButton>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </DetailSection>

          <DetailSection
            icon="ph-certificate"
            color="var(--cx-amber)"
            title={t('gradebook.certificatesHeading')}
            count={certificates?.length ?? 0}
          >
            {loadingCertificates ? (
              <p className="text-muted text-sm">{t('common.loading')}</p>
            ) : !certificates || certificates.length === 0 ? (
              <EmptyHint icon="ph-certificate">{t('gradebook.noCertificates')}</EmptyHint>
            ) : (
              <div className="card" style={{ borderRadius: 20, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>{t('gradebook.colSerial')}</th>
                        <th>{t('gradebook.colStudent')}</th>
                        <th>{t('gradebook.colCourse')}</th>
                        <th style={{ textAlign: 'center' }}>{t('gradebook.colFinalScore')}</th>
                        <th>{t('gradebook.colIssuedAt')}</th>
                        <th style={{ textAlign: 'center' }}>{t('gradebook.colStatus')}</th>
                        <th style={{ textAlign: 'center' }}>{t('gradebook.colAction')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certificates.map((cert) => (
                        <tr key={cert.id}>
                          <td className="font-mono" style={{ fontSize: 11, color: 'var(--color-accent-200)' }}>
                            {cert.serialNo}
                          </td>
                          <td style={{ fontSize: 13 }}>{cert.userFullName}</td>
                          <td className="text-muted" style={{ fontSize: 12 }}>
                            {cert.courseTitle}
                          </td>
                          <td className="cx-display" style={{ textAlign: 'center', color: 'var(--cx-amber)' }}>
                            {cert.finalScore}%
                          </td>
                          <td className="text-muted" style={{ fontSize: 11 }}>
                            {new Date(cert.issuedAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {cert.revokedAt ? (
                              <span className="tag tag-neutral" title={cert.revokedReason || ''}>
                                <i className="ph ph-x-circle" aria-hidden /> {t('gradebook.revoked')}
                              </span>
                            ) : (
                              <span className="tag tag-accent">
                                <i className="ph ph-check-circle" aria-hidden /> {t('gradebook.valid')}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <a
                              href={`/verify/${cert.verificationCode}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mr-3 inline-flex items-center gap-1"
                              style={{ fontSize: 11 }}
                            >
                              <i className="ph ph-arrow-square-out" aria-hidden /> {t('gradebook.verify')}
                            </a>
                            {!cert.revokedAt && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeError(null);
                                  setRevokeCertId(cert.id);
                                }}
                                className="underline"
                                style={{ fontSize: 11, color: ERROR_COLOR }}
                              >
                                {t('gradebook.revoke')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </DetailSection>
        </>
      )}

      {issueModalUser && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ borderRadius: 'var(--cx-radius)' }}>
            <p className="dialog-title cx-display flex items-center gap-2">
              <i className="ph-fill ph-certificate" style={{ color: 'var(--cx-purple)' }} aria-hidden />
              {t('gradebook.issueTitle')}
            </p>
            <p className="dialog-body">{t('gradebook.issueConfirm', { name: issueModalUser.name })}</p>

            {templates && templates.length > 0 && (
              <div className="field">
                <label>{t('gradebook.pickTemplate')}</label>
                <select
                  className="input"
                  value={selectedTemplateId || templates[0].id}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {issueError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{issueError}</p>}

            <div className="dialog-actions">
              <PillButton variant="secondary" onClick={() => setIssueModalUser(null)}>
                {t('common.cancel')}
              </PillButton>
              <PillButton icon="ph-certificate" disabled={issueMutation.isPending} onClick={handleIssue}>
                {issueMutation.isPending ? t('gradebook.issuing') : t('gradebook.issue')}
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {revokeCertId && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ borderRadius: 'var(--cx-radius)' }}>
            <p className="dialog-title cx-display flex items-center gap-2" style={{ color: ERROR_COLOR }}>
              <i className="ph-fill ph-warning" aria-hidden />
              {t('gradebook.revokeTitle')}
            </p>
            <p className="dialog-body">{t('gradebook.revokeHint')}</p>

            <textarea
              className="input"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder={t('gradebook.revokeReasonPlaceholder')}
              rows={3}
            />

            {revokeError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{revokeError}</p>}

            <div className="dialog-actions">
              <PillButton variant="secondary" onClick={() => setRevokeCertId(null)}>
                {t('common.cancel')}
              </PillButton>
              <PillButton
                icon="ph-x-circle"
                variant="secondary"
                disabled={revokeMutation.isPending || !revokeReason.trim()}
                onClick={handleRevoke}
              >
                {revokeMutation.isPending ? t('gradebook.revoking') : t('gradebook.revokeConfirm')}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </DetailColumn>
  );
}
