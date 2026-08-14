import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubmissionDto, SubmissionTypeValue } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useCourses } from '../../features/courses/hooks';
import { useClasses } from '../../features/classes/hooks';
import {
  useAssignments,
  useCreateAssignment,
  useGradeSubmission,
  useSubmissions,
} from '../../features/assessments/hooks';

const dividerBorder = { borderColor: 'var(--color-divider)' } as const;

export function TeachAssignments(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const classes = useClasses();

  const [courseId, setCourseId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const activeCourseId = courseId || courses.data?.items[0]?.id || '';
  const activeClassId = classId || classes.data?.items[0]?.id || '';

  return (
    <div className="space-y-4">
      <div className="card flex flex-row flex-wrap gap-4">
        <div className="field min-w-[200px] flex-1">
          <label>{t('assignments.selectCourse')}</label>
          <select
            className="input"
            value={activeCourseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setSelectedAssignmentId(null);
            }}
          >
            {courses.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field min-w-[200px] flex-1">
          <label>{t('assignments.selectClass')}</label>
          <select className="input" value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {classes.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          {activeCourseId && (
            <CreateAssignmentForm courseId={activeCourseId} onCreated={(id) => setSelectedAssignmentId(id)} />
          )}

          <div className="panel overflow-hidden">
            <div className="panel-head">{t('assignments.heading')}</div>
            {!activeCourseId ? (
              <p className="text-muted px-3 py-4 text-xs">{t('assignments.selectCourse')}</p>
            ) : (
              <AssignmentsList
                courseId={activeCourseId}
                selectedId={selectedAssignmentId}
                onSelect={(id) => setSelectedAssignmentId(id)}
              />
            )}
          </div>
        </div>

        <div>
          {selectedAssignmentId && activeClassId ? (
            <SubmissionsGradingPanel classId={activeClassId} assignmentId={selectedAssignmentId} />
          ) : (
            <p className="text-muted rounded-lg border border-dashed px-4 py-12 text-center text-sm" style={dividerBorder}>
              {t('assignments.selectHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateAssignmentForm({
  courseId,
  onCreated,
}: {
  courseId: string;
  onCreated: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [descriptionMd, setDescriptionMd] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [submissionType, setSubmissionType] = useState<SubmissionTypeValue>('text');
  const [allowLate, setAllowLate] = useState(false);
  const [dueAt, setDueAt] = useState('');

  const create = useCreateAssignment();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        courseId,
        title: title.trim(),
        descriptionMd: descriptionMd.trim() || undefined,
        maxScore: Number(maxScore),
        submissionType,
        allowLate,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      },
      {
        onSuccess: (a) => {
          setTitle('');
          setDescriptionMd('');
          onCreated(a.id);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="card gap-2">
      <p className="card-title">{t('assignments.create')}</p>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('assignments.title')} required />
      <textarea
        className="input text-xs"
        value={descriptionMd}
        onChange={(e) => setDescriptionMd(e.target.value)}
        placeholder={t('assignments.description')}
        rows={2}
      />
      <div className="flex gap-2">
        <div className="field flex-1">
          <label>{t('assignments.maxScore')}</label>
          <input className="input" type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
        </div>
        <div className="field flex-1">
          <label>{t('assignments.submissionType')}</label>
          <select className="input" value={submissionType} onChange={(e) => setSubmissionType(e.target.value as SubmissionTypeValue)}>
            <option value="text">Text</option>
            <option value="link">Link</option>
            <option value="file">File</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t('assignments.dueAt')}</label>
        <input className="input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
        <span className="box">{allowLate ? '✓' : ''}</span>
        <span className="text-sm">{t('assignments.allowLate')}</span>
      </label>
      <button type="submit" disabled={create.isPending} className="btn btn-primary btn-block">
        {t('assignments.add')}
      </button>
      {create.isError && <p className="text-xs text-red-400">{errMsg(create.error)}</p>}
    </form>
  );
}

function AssignmentsList({
  courseId,
  selectedId,
  onSelect,
}: {
  courseId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const assignments = useAssignments(courseId);

  if (assignments.isLoading) return <p className="text-muted px-3 py-4 text-xs">{t('common.loading')}</p>;
  if (assignments.data?.items.length === 0) {
    return <p className="text-muted px-3 py-4 text-xs">{t('assignments.empty')}</p>;
  }

  return (
    <ul>
      {assignments.data?.items.map((a) => (
        <li key={a.id}>
          <button
            onClick={() => onSelect(a.id)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
            style={selectedId === a.id ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' } : undefined}
          >
            <p className="truncate font-medium">{a.title}</p>
            <p className="text-muted text-xs">
              {t('assignments.maxScore')}: {a.maxScore} · {a.submissionType}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SubmissionsGradingPanel({
  classId,
  assignmentId,
}: {
  classId: string;
  assignmentId: string;
}): JSX.Element {
  const { t } = useTranslation();
  const submissions = useSubmissions(classId, assignmentId);
  const [selectedSub, setSelectedSub] = useState<SubmissionDto | null>(null);

  if (submissions.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;

  const items = submissions.data?.items || [];

  return (
    <div className="card gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base">{t('assignments.submissionsHeading')}</h2>
        <span className="text-muted text-xs">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-muted py-6 text-center text-xs">{t('assignments.noSubmissions')}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ul className="panel overflow-hidden">
            {items.map((sub) => (
              <li key={sub.id}>
                <button
                  onClick={() => setSelectedSub(sub)}
                  className="flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-white/5"
                  style={selectedSub?.id === sub.id ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' } : undefined}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{sub.fullName || sub.email || sub.userId}</p>
                    <p className="text-muted text-[10px]">{sub.email}</p>
                  </div>
                  <SubmissionStatusBadge status={sub.status} score={sub.score} />
                </button>
              </li>
            ))}
          </ul>

          <div>
            {selectedSub ? (
              <GradingForm classId={classId} assignmentId={assignmentId} submission={selectedSub} />
            ) : (
              <p className="text-muted rounded-md border border-dashed p-6 text-center text-xs" style={dividerBorder}>
                {t('assignments.pickStudent', { defaultValue: 'Chọn một học viên để xem bài và chấm điểm' })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GradingForm({
  classId,
  assignmentId,
  submission,
}: {
  classId: string;
  assignmentId: string;
  submission: SubmissionDto;
}): JSX.Element {
  const { t } = useTranslation();
  const [score, setScore] = useState<number>(submission.score ?? 100);
  const [feedbackMd, setFeedbackMd] = useState<string>(submission.feedbackMd ?? '');
  const gradeMutation = useGradeSubmission(classId, assignmentId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    gradeMutation.mutate({
      submissionId: submission.id,
      body: { score: Number(score), feedbackMd: feedbackMd.trim() || undefined },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md p-3" style={{ background: 'var(--color-neutral-900)', boxShadow: 'inset 0 0 0 1px var(--color-divider)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">{submission.fullName || submission.email}</p>
        <SubmissionStatusBadge status={submission.status} score={submission.score} />
      </div>

      <div className="chip text-xs">
        <p className="text-muted font-medium">{t('assignments.submissionContent', { defaultValue: 'Nội dung bài làm' })}:</p>
        {submission.contentText && <p className="mt-1 whitespace-pre-wrap">{submission.contentText}</p>}
        {submission.linkUrl && (
          <a href={submission.linkUrl} target="_blank" rel="noreferrer" className="mt-1 block underline">
            {submission.linkUrl}
          </a>
        )}
        {!submission.contentText && !submission.linkUrl && (
          <p className="text-muted mt-1 italic">({t('common.empty', { defaultValue: 'Trống' })})</p>
        )}
      </div>

      <div className="field">
        <label>{t('assignments.score')}</label>
        <input className="input" type="number" step="0.5" min={0} max={1000} value={score} onChange={(e) => setScore(Number(e.target.value))} required />
      </div>

      <div className="field">
        <label>{t('assignments.feedback')}</label>
        <textarea className="input" value={feedbackMd} onChange={(e) => setFeedbackMd(e.target.value)} placeholder={t('assignments.feedback')} rows={3} />
      </div>

      <button type="submit" disabled={gradeMutation.isPending} className="btn btn-primary btn-block">
        {t('assignments.submitGrade')}
      </button>

      {gradeMutation.isSuccess && <p className="text-xs text-[var(--color-accent-300)]">✔ {t('assignments.gradeSaved', { defaultValue: 'Đã lưu điểm thành công!' })}</p>}
      {gradeMutation.isError && <p className="text-xs text-red-400">{errMsg(gradeMutation.error)}</p>}
    </form>
  );
}

function SubmissionStatusBadge({ status, score }: { status: string; score?: number | null }): JSX.Element {
  const { t } = useTranslation();
  const cls = status === 'graded' ? 'tag tag-accent' : status === 'submitted' ? 'tag tag-outline' : 'tag tag-neutral';
  return (
    <span className={`${cls} shrink-0`}>
      {t(`submissions.status_${status}`, { defaultValue: status })}
      {status === 'graded' && score !== null && score !== undefined && ` (${score})`}
    </span>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
