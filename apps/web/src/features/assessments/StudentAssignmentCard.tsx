import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentSummary } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useMySubmission, useSaveSubmission, useSubmitSubmission } from './hooks';

export function StudentAssignmentCard({
  classId,
  assignment,
}: {
  classId: string;
  assignment: AssignmentSummary;
}): JSX.Element {
  const { t } = useTranslation();
  const subQuery = useMySubmission(assignment.id, classId);
  const saveMutation = useSaveSubmission(assignment.id, classId);
  const submitMutation = useSubmitSubmission(assignment.id, classId);

  const submission = subQuery.data;

  const [contentText, setContentText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (submission) {
      setContentText(submission.contentText || '');
      setLinkUrl(submission.linkUrl || '');
    }
  }, [submission]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    saveMutation.mutate(
      {
        classId,
        contentText: contentText.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSuccessMsg(t('submissions.draftSaved', { defaultValue: 'Đã lưu nháp thành công!' }));
        },
      },
    );
  };

  const handleSubmit = () => {
    setSuccessMsg('');
    submitMutation.mutate(
      { classId },
      {
        onSuccess: () => {
          setSuccessMsg(t('submissions.submittedSuccess'));
        },
      },
    );
  };

  const isGraded = submission?.status === 'graded';
  const isSubmitted = submission?.status === 'submitted';

  return (
    <div className="card gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="card-title">{assignment.title}</h3>
          <p className="card-meta">
            {t('assignments.maxScore')}: {assignment.maxScore} · {assignment.submissionType}
            {assignment.dueAt && ` · ${t('assignments.dueAt')}: ${new Date(assignment.dueAt).toLocaleDateString()}`}
          </p>
        </div>
        {submission && (
          <span className={isGraded ? 'tag tag-accent' : isSubmitted ? 'tag tag-outline' : 'tag tag-neutral'}>
            {t(`submissions.status_${submission.status}`, { defaultValue: submission.status })}
          </span>
        )}
      </div>

      {isGraded && (
        <div className="space-y-1 rounded-md p-3 text-xs" style={{ background: 'var(--color-accent-900)', border: '1px solid var(--color-accent-700)' }}>
          <p className="font-bold" style={{ color: 'var(--color-accent-100)' }}>
            {t('submissions.scoreTitle')}: {submission.score} / {assignment.maxScore}
          </p>
          {submission.feedbackMd && (
            <p style={{ color: 'var(--color-accent-300)' }}>
              <span className="font-medium">{t('assignments.feedback')}:</span> {submission.feedbackMd}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-2">
        {assignment.submissionType === 'link' || assignment.submissionType === 'text' ? (
          <div className="field">
            <label>{t('submissions.yourSubmission')}</label>
            {assignment.submissionType === 'link' && (
              <input
                className="input mb-2"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={t('submissions.linkPlaceholder')}
                disabled={isGraded}
              />
            )}
            <textarea
              className="input text-xs"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder={t('submissions.contentPlaceholder')}
              rows={3}
              disabled={isGraded}
            />
          </div>
        ) : null}

        {!isGraded && (
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={saveMutation.isPending || submitMutation.isPending} className="btn btn-secondary">
              {t('submissions.saveDraft')}
            </button>
            <button type="button" onClick={handleSubmit} disabled={saveMutation.isPending || submitMutation.isPending} className="btn btn-primary">
              {t('submissions.submit')}
            </button>
          </div>
        )}

        {successMsg && <p className="text-xs" style={{ color: 'var(--color-accent-300)' }}>{successMsg}</p>}
        {saveMutation.isError && <p className="text-xs text-red-400">{errMsg(saveMutation.error)}</p>}
        {submitMutation.isError && <p className="text-xs text-red-400">{errMsg(submitMutation.error)}</p>}
      </form>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
