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

export function TeachAssignments(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const classes = useClasses();

  const [courseId, setCourseId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Chọn course/class đầu tiên khi load xong
  const activeCourseId = courseId || courses.data?.items[0]?.id || '';
  const activeClassId = classId || classes.data?.items[0]?.id || '';

  return (
    <div className="space-y-4">
      {/* Thanh chọn Khóa học và Lớp học */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('assignments.selectCourse')}
          </label>
          <select
            value={activeCourseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setSelectedAssignmentId(null);
            }}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {courses.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('assignments.selectClass')}
          </label>
          <select
            value={activeClassId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {classes.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        {/* Cột trái: Tạo & Danh sách bài tập */}
        <div className="space-y-4">
          {activeCourseId && (
            <CreateAssignmentForm
              courseId={activeCourseId}
              onCreated={(id) => setSelectedAssignmentId(id)}
            />
          )}

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-sm font-medium">
              {t('assignments.heading')}
            </div>
            {!activeCourseId ? (
              <p className="px-3 py-4 text-xs text-slate-400">{t('assignments.selectCourse')}</p>
            ) : (
              <AssignmentsList
                courseId={activeCourseId}
                selectedId={selectedAssignmentId}
                onSelect={(id) => setSelectedAssignmentId(id)}
              />
            )}
          </div>
        </div>

        {/* Cột phải: Xem bài nộp & Chấm điểm */}
        <div>
          {selectedAssignmentId && activeClassId ? (
            <SubmissionsGradingPanel
              classId={activeClassId}
              assignmentId={selectedAssignmentId}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
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
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium">{t('assignments.create')}</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('assignments.title')}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <textarea
        value={descriptionMd}
        onChange={(e) => setDescriptionMd(e.target.value)}
        placeholder={t('assignments.description')}
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-slate-500">{t('assignments.maxScore')}</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] text-slate-500">{t('assignments.submissionType')}</label>
          <select
            value={submissionType}
            onChange={(e) => setSubmissionType(e.target.value as SubmissionTypeValue)}
            className="w-full rounded border border-slate-300 px-1 py-1 text-xs"
          >
            <option value="text">Text</option>
            <option value="link">Link</option>
            <option value="file">File</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] text-slate-500">{t('assignments.dueAt')}</label>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={allowLate}
          onChange={(e) => setAllowLate(e.target.checked)}
        />
        {t('assignments.allowLate')}
      </label>
      <button
        type="submit"
        disabled={create.isPending}
        className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {t('assignments.add')}
      </button>
      {create.isError && <p className="text-xs text-red-600">{errMsg(create.error)}</p>}
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

  if (assignments.isLoading) return <p className="px-3 py-4 text-xs text-slate-400">{t('common.loading')}</p>;
  if (assignments.data?.items.length === 0) {
    return <p className="px-3 py-4 text-xs text-slate-400">{t('assignments.empty')}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {assignments.data?.items.map((a) => (
        <li key={a.id}>
          <button
            onClick={() => onSelect(a.id)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
              selectedId === a.id ? 'bg-slate-100 font-medium' : ''
            }`}
          >
            <p className="truncate font-medium">{a.title}</p>
            <p className="text-xs text-slate-400">
              Score: {a.maxScore} · {a.submissionType}
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

  if (submissions.isLoading) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;

  const items = submissions.data?.items || [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold">{t('assignments.submissionsHeading')}</h2>
          <span className="text-xs text-slate-400">Total: {items.length}</span>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            {t('assignments.noSubmissions')}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ul className="divide-y divide-slate-100 rounded border border-slate-200">
              {items.map((sub) => (
                <li key={sub.id}>
                  <button
                    onClick={() => setSelectedSub(sub)}
                    className={`flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-slate-50 ${
                      selectedSub?.id === sub.id ? 'bg-slate-100 font-medium' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {sub.fullName || sub.email || sub.userId}
                      </p>
                      <p className="text-[10px] text-slate-400">{sub.email}</p>
                    </div>
                    <SubmissionStatusBadge status={sub.status} score={sub.score} />
                  </button>
                </li>
              ))}
            </ul>

            <div>
              {selectedSub ? (
                <GradingForm
                  classId={classId}
                  assignmentId={assignmentId}
                  submission={selectedSub}
                />
              ) : (
                <p className="rounded border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  Chọn một học viên để xem bài và chấm điểm
                </p>
              )}
            </div>
          </div>
        )}
      </div>
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
    <form onSubmit={submit} className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">
          {submission.fullName || submission.email}
        </p>
        <SubmissionStatusBadge status={submission.status} score={submission.score} />
      </div>

      <div className="rounded bg-white p-2 text-xs">
        <p className="font-medium text-slate-500">Nội dung bài làm:</p>
        {submission.contentText && (
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{submission.contentText}</p>
        )}
        {submission.linkUrl && (
          <a
            href={submission.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-blue-600 underline hover:text-blue-800"
          >
            {submission.linkUrl}
          </a>
        )}
        {!submission.contentText && !submission.linkUrl && (
          <p className="mt-1 text-slate-400 font-italic">(Trống)</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">{t('assignments.score')}</label>
        <input
          type="number"
          step="0.5"
          min={0}
          max={1000}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          required
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">{t('assignments.feedback')}</label>
        <textarea
          value={feedbackMd}
          onChange={(e) => setFeedbackMd(e.target.value)}
          placeholder={t('assignments.feedback')}
          rows={3}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        />
      </div>

      <button
        type="submit"
        disabled={gradeMutation.isPending}
        className="w-full rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {t('assignments.submitGrade')}
      </button>

      {gradeMutation.isSuccess && (
        <p className="text-[10px] text-emerald-600 font-medium">✔ Đã lưu điểm thành công!</p>
      )}
      {gradeMutation.isError && (
        <p className="text-[10px] text-red-600">{errMsg(gradeMutation.error)}</p>
      )}
    </form>
  );
}

function SubmissionStatusBadge({ status, score }: { status: string; score?: number | null }): JSX.Element {
  const { t } = useTranslation();
  const cls =
    status === 'graded'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'submitted'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {t(`submissions.status_${status}`, { defaultValue: status })}
      {status === 'graded' && score !== null && score !== undefined && ` (${score})`}
    </span>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
