import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AssignmentDetail, SubmissionDto } from '@lms/contracts';
import { useSaveSubmission, useSubmitSubmission } from '../assessments/hooks';
import { useMyProjects } from './hooks';

/**
 * Nộp bài BlockSpace (T11.7): chọn một dự án của mình → server ĐÓNG BĂNG phiên bản mới nhất. Nộp xong em vẫn
 * sửa tiếp được; bài đã nộp giữ nguyên bản lúc nộp. Nộp lại (khi chưa chấm) = đóng băng bản mới hơn.
 */
export function ScratchSubmissionFields({
  classId,
  assignment,
  submission,
}: {
  classId: string;
  assignment: AssignmentDetail;
  submission: SubmissionDto | null;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const mine = useMyProjects();
  const save = useSaveSubmission(assignment.id, classId);
  const submit = useSubmitSubmission(assignment.id, classId);
  const projects = (mine.data ?? []).filter((p) => p.latestSeq !== null);
  const [picked, setPicked] = useState<string>('');
  const projectId = picked || submission?.scratch?.projectId || projects[0]?.id || '';
  const graded = submission?.status === 'graded';
  const busy = save.isPending || submit.isPending;
  const error = save.error ?? submit.error;
  const [done, setDone] = useState(false);

  const send = () => {
    setDone(false);
    save.mutate(
      { classId, scratchProjectId: projectId },
      { onSuccess: () => submit.mutate({ classId }, { onSuccess: () => setDone(true) }) },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {submission?.scratch && (
        <p className="m-0 text-sm">
          <i className="ph ph-seal-check" style={{ color: 'var(--cx-teal)' }} aria-hidden />{' '}
          {t('assignments.scratchSubmitted', {
            title: submission.scratch.projectTitle,
            seq: submission.scratch.versionSeq,
            time: new Date(submission.scratch.frozenAt).toLocaleString(i18n.language),
          })}{' '}
          <Link to={`/studio/${submission.scratch.projectId}`} className="underline">
            {t('studio.viewProject')}
          </Link>
        </p>
      )}

      {!graded &&
        (projects.length === 0 ? (
          <p className="text-muted m-0 text-sm">
            {mine.isLoading ? t('common.loading') : t('assignments.scratchNoProjects')}{' '}
            {!mine.isLoading && (
              <Link to="/studio" className="underline">
                BlockSpace
              </Link>
            )}
          </p>
        ) : (
          <>
            <div className="field m-0">
              <label htmlFor={`scratch-pick-${assignment.id}`}>{t('assignments.scratchPick')}</label>
              <select
                id={`scratch-pick-${assignment.id}`}
                className="input"
                value={projectId}
                disabled={busy}
                onChange={(e) => setPicked(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-muted m-0 text-xs">{t('assignments.scratchHint')}</p>
            <div className="pt-1">
              <button type="button" className="btn btn-primary" disabled={busy || !projectId} onClick={send}>
                <i className="ph ph-paper-plane-tilt" aria-hidden />{' '}
                {submission?.scratch ? t('assignments.scratchResubmit') : t('assignments.scratchSubmit')}
              </button>
            </div>
          </>
        ))}

      {done && (
        <p className="m-0 text-xs" style={{ color: 'var(--color-accent-300)' }}>
          {t('submissions.submittedSuccess')}
        </p>
      )}
      {error && <p className="m-0 text-xs text-red-400">{error.message}</p>}
    </div>
  );
}
