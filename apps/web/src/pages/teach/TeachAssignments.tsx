import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentSummary, SubmissionDto, SubmissionTypeValue } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useCourses } from '../../features/courses/hooks';
import { useClasses } from '../../features/classes/hooks';
import {
  useAssignments,
  useCreateAssignment,
  useGradeSubmission,
  useSubmissions,
  useSubmissionsByAssignments,
} from '../../features/assessments/hooks';
import {
  DetailColumn,
  DetailHeader,
  DetailSection,
  EmptyHint,
  IconTile,
  PillButton,
  Sidebar,
  SidebarCard,
  TeachShell,
} from './teachUi';

const ERROR_COLOR = '#f4a3a3';
const PENDING_COLOR = 'var(--cx-amber)';
const DONE_COLOR = 'var(--cx-teal)';

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('vi-VN');
}

export function TeachAssignments(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const classes = useClasses();

  const [courseId, setCourseId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeCourseId = courseId || courses.data?.items[0]?.id || '';
  const activeClassId = classId || classes.data?.items[0]?.id || '';

  const assignments = useAssignments(activeCourseId);
  const items = useMemo(() => assignments.data?.items ?? [], [assignments.data]);
  const assignmentIds = useMemo(() => items.map((a) => a.id), [items]);
  const submissionQueries = useSubmissionsByAssignments(activeClassId || null, assignmentIds);

  /** {đã nộp, chờ chấm} theo từng bài tập trong lớp đang chọn. */
  const statsById = useMemo(() => {
    const m = new Map<string, { submitted: number; pending: number }>();
    assignmentIds.forEach((id, i) => {
      const rows = submissionQueries[i]?.data?.items;
      if (!rows) return;
      const graded = rows.filter((s) => s.status === 'graded').length;
      const submitted = rows.filter((s) => s.status !== 'draft').length;
      m.set(id, { submitted, pending: submitted - graded });
    });
    return m;
  }, [assignmentIds, submissionQueries]);

  const selected = items.find((a) => a.id === selectedAssignmentId) ?? null;

  return (
    <DetailColumn>
      <div className="card flex-row flex-wrap gap-4" style={{ borderRadius: 20, padding: 'var(--space-6)' }}>
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

      <TeachShell
        sidebar={
          <Sidebar
            icon="ph-clipboard-text"
            color={PENDING_COLOR}
            title={t('assignments.heading')}
            count={items.length}
            footer={
              creating && activeCourseId ? (
                <CreateAssignmentForm
                  courseId={activeCourseId}
                  onCancel={() => setCreating(false)}
                  onCreated={(id) => {
                    setSelectedAssignmentId(id);
                    setCreating(false);
                  }}
                />
              ) : (
                <PillButton icon="ph-plus" disabled={!activeCourseId} onClick={() => setCreating(true)}>
                  {t('assignments.create')}
                </PillButton>
              )
            }
          >
            {assignments.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
            {!activeCourseId && <EmptyHint icon="ph-books">{t('assignments.selectCourse')}</EmptyHint>}
            {activeCourseId && items.length === 0 && !assignments.isLoading && (
              <EmptyHint icon="ph-clipboard-text">{t('assignments.empty')}</EmptyHint>
            )}
            {items.map((a) => {
              const stats = statsById.get(a.id);
              // Chưa ai nộp → trung tính; còn bài chờ chấm → amber; chấm hết → teal.
              const color = !stats || stats.submitted === 0 ? 'var(--cx-purple)' : stats.pending > 0 ? PENDING_COLOR : DONE_COLOR;
              const due = fmtDate(a.dueAt);
              return (
                <SidebarCard
                  key={a.id}
                  icon="ph-clipboard-text"
                  color={color}
                  title={a.title}
                  meta={due ? t('assignments.dueShort', { date: due }) : t('assignments.noDue')}
                  selected={selectedAssignmentId === a.id}
                  onClick={() => setSelectedAssignmentId(a.id)}
                  tag={
                    stats &&
                    (stats.submitted === 0 ? (
                      <span className="tag tag-neutral">{t('assignments.noSubmissionsYet')}</span>
                    ) : (
                      <>
                        <span className="tag tag-neutral">
                          {t('assignments.submittedCount', { count: stats.submitted })}
                        </span>
                        <span className={stats.pending > 0 ? 'tag tag-outline' : 'tag tag-accent'}>
                          {stats.pending > 0
                            ? t('assignments.pendingCount', { count: stats.pending })
                            : t('assignments.allGraded')}
                        </span>
                      </>
                    ))
                  }
                />
              );
            })}
          </Sidebar>
        }
      >
        {selected && activeClassId ? (
          <AssignmentDetail assignment={selected} classId={activeClassId} stats={statsById.get(selected.id)} />
        ) : (
          <EmptyHint icon="ph-hand-pointing">{t('assignments.selectHint')}</EmptyHint>
        )}
      </TeachShell>
    </DetailColumn>
  );
}

function AssignmentDetail({
  assignment,
  classId,
  stats,
}: {
  assignment: AssignmentSummary;
  classId: string;
  stats?: { submitted: number; pending: number };
}): JSX.Element {
  const { t } = useTranslation();
  const due = fmtDate(assignment.dueAt);

  const chips = [
    {
      icon: 'ph-users-three',
      color: 'var(--cx-blue)',
      label: t('assignments.chipSubmitted'),
      value: String(stats?.submitted ?? 0),
    },
    {
      icon: 'ph-hourglass-medium',
      color: PENDING_COLOR,
      label: t('assignments.chipPending'),
      value: String(stats?.pending ?? 0),
    },
    {
      icon: 'ph-star',
      color: DONE_COLOR,
      label: t('assignments.maxScore'),
      value: String(assignment.maxScore),
    },
  ];

  return (
    <DetailColumn>
      <DetailHeader
        icon="ph-clipboard-text"
        color={PENDING_COLOR}
        title={assignment.title}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span>{due ? t('assignments.dueLong', { date: due }) : t('assignments.noDue')}</span>
            <span aria-hidden>·</span>
            <span>{t('assignments.maxScoreValue', { score: assignment.maxScore })}</span>
          </span>
        }
      >
        <div className="flex flex-wrap gap-2.5">
          {chips.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-2.5"
              style={{
                borderRadius: 16,
                padding: '8px 14px',
                background: 'color-mix(in srgb, var(--color-text) 5%, transparent)',
                boxShadow: 'inset 0 0 0 1px var(--color-divider)',
              }}
            >
              <IconTile icon={c.icon} color={c.color} size={30} />
              <div>
                <p className="cx-display m-0" style={{ fontSize: 16, lineHeight: 1.1 }}>
                  {c.value}
                </p>
                <p className="text-muted m-0" style={{ fontSize: 11 }}>
                  {c.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DetailHeader>

      <DetailSection icon="ph-check-square-offset" color={DONE_COLOR} title={t('assignments.gradingHeading')}>
        <SubmissionsGradingPanel classId={classId} assignment={assignment} />
      </DetailSection>
    </DetailColumn>
  );
}

function CreateAssignmentForm({
  courseId,
  onCreated,
  onCancel,
}: {
  courseId: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
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
    <form onSubmit={submit} className="card gap-2" style={{ borderRadius: 18 }}>
      <p className="cx-display m-0" style={{ fontSize: 14 }}>
        {t('assignments.create')}
      </p>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('assignments.title')}
        required
      />
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
          <input
            className="input"
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
          />
        </div>
        <div className="field flex-1">
          <label>{t('assignments.submissionType')}</label>
          <select
            className="input"
            value={submissionType}
            onChange={(e) => setSubmissionType(e.target.value as SubmissionTypeValue)}
          >
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
      <div className="flex gap-2">
        <PillButton type="submit" icon="ph-plus" disabled={create.isPending}>
          {t('assignments.add')}
        </PillButton>
        <PillButton variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </PillButton>
      </div>
      {create.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(create.error)}</p>}
    </form>
  );
}

function SubmissionsGradingPanel({
  classId,
  assignment,
}: {
  classId: string;
  assignment: AssignmentSummary;
}): JSX.Element {
  const { t } = useTranslation();
  const submissions = useSubmissions(classId, assignment.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (submissions.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;

  const items = submissions.data?.items ?? [];
  const selected = items.find((s) => s.id === selectedId) ?? null;

  if (items.length === 0) {
    return <EmptyHint icon="ph-tray">{t('assignments.noSubmissions')}</EmptyHint>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        {items.map((sub) => {
          const active = selectedId === sub.id;
          const color = sub.status === 'graded' ? DONE_COLOR : PENDING_COLOR;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedId(sub.id)}
              className="cx-lift cx-press w-full text-left"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 'var(--space-4)',
                borderRadius: 16,
                background: active ? `color-mix(in srgb, ${color} 14%, var(--color-surface))` : 'var(--color-surface)',
                boxShadow: active
                  ? `inset 0 0 0 1.5px color-mix(in srgb, ${color} 55%, transparent)`
                  : 'inset 0 0 0 1px var(--color-divider)',
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate" style={{ fontSize: 13 }}>
                  {sub.fullName || sub.email || sub.userId}
                </p>
                <p className="text-muted m-0 truncate" style={{ fontSize: 11 }}>
                  {sub.email}
                </p>
              </div>
              <SubmissionStatusBadge status={sub.status} score={sub.score} />
            </button>
          );
        })}
      </div>

      <div>
        {selected ? (
          <GradingForm classId={classId} assignment={assignment} submission={selected} />
        ) : (
          <EmptyHint icon="ph-cursor-click">{t('assignments.pickStudent')}</EmptyHint>
        )}
      </div>
    </div>
  );
}

function GradingForm({
  classId,
  assignment,
  submission,
}: {
  classId: string;
  assignment: AssignmentSummary;
  submission: SubmissionDto;
}): JSX.Element {
  const { t } = useTranslation();
  const [score, setScore] = useState<number>(submission.score ?? assignment.maxScore);
  const [feedbackMd, setFeedbackMd] = useState<string>(submission.feedbackMd ?? '');
  const gradeMutation = useGradeSubmission(classId, assignment.id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    gradeMutation.mutate({
      submissionId: submission.id,
      body: { score: Number(score), feedbackMd: feedbackMd.trim() || undefined },
    });
  };

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="cx-display m-0 truncate" style={{ fontSize: 15 }}>
            {submission.fullName || submission.email}
          </p>
          <p className="text-muted m-0 truncate" style={{ fontSize: 11 }}>
            {submission.email}
          </p>
        </div>
        <SubmissionStatusBadge status={submission.status} score={submission.score} />
      </div>

      <div
        style={{
          borderRadius: 14,
          background: 'var(--color-neutral-900)',
          boxShadow: 'inset 0 0 0 1px var(--color-divider)',
          padding: 'var(--space-5)',
        }}
      >
        <p className="text-muted m-0" style={{ fontSize: 11, marginBottom: 6 }}>
          {t('assignments.submissionContent')}
        </p>
        {submission.contentText && (
          <p className="m-0" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {submission.contentText}
          </p>
        )}
        {submission.linkUrl && (
          <a href={submission.linkUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm underline">
            {submission.linkUrl}
          </a>
        )}
        {!submission.contentText && !submission.linkUrl && (
          <p className="text-muted m-0 italic" style={{ fontSize: 13 }}>
            ({t('common.empty')})
          </p>
        )}
      </div>

      <div className="field">
        <label>{t('assignments.scoreOutOf', { max: assignment.maxScore })}</label>
        <input
          className="input"
          type="number"
          step="0.5"
          min={0}
          max={1000}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          required
        />
      </div>

      <div className="field">
        <label>{t('assignments.feedback')}</label>
        <textarea
          className="input"
          value={feedbackMd}
          onChange={(e) => setFeedbackMd(e.target.value)}
          placeholder={t('assignments.feedback')}
          rows={4}
        />
      </div>

      <button type="submit" disabled={gradeMutation.isPending} className="btn btn-primary btn-block cx-press">
        <i className="ph ph-paper-plane-tilt" aria-hidden /> {t('assignments.submitGrade')}
      </button>

      {gradeMutation.isSuccess && (
        <p className="m-0 text-xs" style={{ color: 'var(--color-accent-300)' }}>
          ✔ {t('assignments.gradeSaved')}
        </p>
      )}
      {gradeMutation.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(gradeMutation.error)}</p>}
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
