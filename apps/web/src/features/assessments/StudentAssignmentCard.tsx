import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentSummary } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import {
  useMySubmission,
  useSaveSubmission,
  useSubmitSubmission,
} from './hooks';

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
          setSuccessMsg('Đã lưu nháp thành công!');
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
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <h3 className="font-semibold text-slate-800">{assignment.title}</h3>
          <p className="text-xs text-slate-400">
            Score: {assignment.maxScore} · {assignment.submissionType}
            {assignment.dueAt && ` · Hạn nộp: ${new Date(assignment.dueAt).toLocaleDateString()}`}
          </p>
        </div>
        {submission && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              isGraded
                ? 'bg-emerald-100 text-emerald-700'
                : isSubmitted
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t(`submissions.status_${submission.status}`, { defaultValue: submission.status })}
          </span>
        )}
      </div>

      {/* Hiển thị Điểm & Feedback của Giáo Viên nếu đã chấm */}
      {isGraded && (
        <div className="space-y-1 rounded-md bg-emerald-50 p-3 text-xs border border-emerald-200">
          <p className="font-bold text-emerald-800">
            {t('submissions.scoreTitle')}: {submission.score} / {assignment.maxScore}
          </p>
          {submission.feedbackMd && (
            <p className="text-emerald-700">
              <span className="font-medium">Nhận xét:</span> {submission.feedbackMd}
            </p>
          )}
        </div>
      )}

      {/* Form Nộp Bài */}
      <form onSubmit={handleSave} className="space-y-2">
        {assignment.submissionType === 'link' || assignment.submissionType === 'text' ? (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('submissions.yourSubmission')}
            </label>
            {assignment.submissionType === 'link' && (
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={t('submissions.linkPlaceholder')}
                disabled={isGraded}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs disabled:bg-slate-100 mb-2"
              />
            )}
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder={t('submissions.contentPlaceholder')}
              rows={3}
              disabled={isGraded}
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs disabled:bg-slate-100"
            />
          </div>
        ) : null}

        {!isGraded && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saveMutation.isPending || submitMutation.isPending}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
            >
              {t('submissions.saveDraft')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saveMutation.isPending || submitMutation.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {t('submissions.submit')}
            </button>
          </div>
        )}

        {successMsg && <p className="text-xs text-emerald-600 font-medium">{successMsg}</p>}
        {saveMutation.isError && (
          <p className="text-xs text-red-600">{errMsg(saveMutation.error)}</p>
        )}
        {submitMutation.isError && (
          <p className="text-xs text-red-600">{errMsg(submitMutation.error)}</p>
        )}
      </form>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
