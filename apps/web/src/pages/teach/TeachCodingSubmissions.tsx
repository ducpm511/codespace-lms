import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClassCodingProblemDto,
  ClassCodingStudentRowDto,
  CodingProblemSummary,
  ReviewTestCaseResultDto,
} from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useClass, useClasses } from '../../features/classes/hooks';
import { useCourse } from '../../features/courses/hooks';
import {
  useClassCodingOverview,
  useClassProblemSubmissions,
  useCodingSubmissionReview,
} from '../../features/coding/hooks';
import { DetailColumn, DetailHeader, DetailSection, EmptyHint, PillButton, Sidebar, SidebarCard, TeachShell } from './teachUi';
import { filterProblems, groupProblems } from './codingGroups';
import { ChapterBlock, IoPanel, diffColor } from './codingUi';

const ERROR_COLOR = '#f4a3a3';

/** Giáo viên xem bài nộp lập trình: lớp → bài → học viên → code và kết quả từng test của một lần nộp. */
export function TeachCodingSubmissions(): JSX.Element {
  const { t } = useTranslation();
  const classes = useClasses();
  const [classId, setClassId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [problemId, setProblemId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // null = chưa đụng tới: mở sẵn chương đầu, giống danh sách bên Biên soạn.
  const [openChapters, setOpenChapters] = useState<Set<string> | null>(null);

  const activeClassId = classId || classes.data?.items[0]?.id || null;
  const classDetail = useClass(activeClassId);
  const overview = useClassCodingOverview(activeClassId);

  const courses = classDetail.data?.courses ?? [];
  const activeCourseId = courseId || courses[0]?.courseId || null;
  const course = useCourse(activeCourseId);
  const sections = useMemo(() => course.data?.sections ?? [], [course.data]);

  const courseProblems = useMemo(
    () => (overview.data?.problems ?? []).filter((p) => p.courseId === activeCourseId),
    [overview.data, activeCourseId],
  );
  const statsById = useMemo(() => new Map(courseProblems.map((p) => [p.id, p])), [courseProblems]);
  const chapters = useMemo(
    () => groupProblems(filterProblems(courseProblems, sections, { query, difficulty: '' }), sections),
    [courseProblems, sections, query],
  );

  const isFiltering = query.trim() !== '';
  const effectiveOpen = openChapters ?? new Set(chapters.slice(0, 1).map((c) => c.key));
  const toggleChapter = (key: string) => {
    const next = new Set(effectiveOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenChapters(next);
  };

  const resetSelection = () => {
    setProblemId(null);
    setQuery('');
    setOpenChapters(null);
  };

  if (classes.data?.items.length === 0) {
    return <EmptyHint icon="ph-users-three">{t('coding.reviewNoClasses')}</EmptyHint>;
  }

  const forbidden = overview.error instanceof ApiError && overview.error.status === 403;

  return (
    <DetailColumn>
      <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)' }}>
        <div className="flex flex-wrap" style={{ gap: 'var(--space-4)' }}>
          <div className="field min-w-[220px] flex-1">
            <label htmlFor="review-class">{t('coding.reviewPickClass')}</label>
            <select
              id="review-class"
              className="input"
              value={activeClassId ?? ''}
              onChange={(e) => {
                setClassId(e.target.value);
                setCourseId('');
                resetSelection();
              }}
            >
              {classes.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          {courses.length > 1 && (
            <div className="field min-w-[220px] flex-1">
              <label htmlFor="review-course">{t('assignments.selectCourse')}</label>
              <select
                id="review-course"
                className="input"
                value={activeCourseId ?? ''}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  resetSelection();
                }}
              >
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {forbidden ? (
        <EmptyHint icon="ph-lock-key">{t('coding.reviewNotYourClass')}</EmptyHint>
      ) : overview.isError ? (
        <EmptyHint icon="ph-warning">{t('coding.reviewLoadFailed')}</EmptyHint>
      ) : (
        <TeachShell
          sidebar={
            <Sidebar icon="ph-tray-arrow-down" color="var(--cx-teal)" title={t('coding.reviewHeading')} count={courseProblems.length}>
              {overview.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
              {overview.data && courseProblems.length === 0 && (
                <EmptyHint icon="ph-code">{t('coding.reviewNoProblems')}</EmptyHint>
              )}
              {courseProblems.length > 0 && (
                <div className="relative">
                  <i className="ph ph-magnifying-glass text-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
                  <input
                    className="input pl-9"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('coding.searchPlaceholder')}
                    aria-label={t('coding.searchPlaceholder')}
                  />
                </div>
              )}
              {isFiltering && chapters.length === 0 && <EmptyHint icon="ph-magnifying-glass">{t('coding.noMatch')}</EmptyHint>}
              {chapters.length > 0 && (
                <div
                  className="flex flex-col"
                  style={{
                    gap: 'var(--space-4)',
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    padding: 2,
                    paddingRight: 8,
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--color-divider) transparent',
                  }}
                >
                  {chapters.map((chapter) => (
                    <ChapterBlock
                      key={chapter.key}
                      chapter={chapter}
                      open={isFiltering || effectiveOpen.has(chapter.key)}
                      onToggle={isFiltering ? undefined : () => toggleChapter(chapter.key)}
                      renderProblem={(p) => (
                        <ProblemCard
                          key={p.id}
                          problem={p}
                          stats={statsById.get(p.id)}
                          studentCount={overview.data?.studentCount ?? 0}
                          selected={problemId === p.id}
                          onSelect={() => setProblemId(p.id)}
                        />
                      )}
                    />
                  ))}
                </div>
              )}
            </Sidebar>
          }
        >
          {problemId && activeClassId ? (
            <ProblemSubmissions key={`${activeClassId}:${problemId}`} classId={activeClassId} problemId={problemId} />
          ) : (
            <EmptyHint icon="ph-hand-pointing">{t('coding.reviewSelectHint')}</EmptyHint>
          )}
        </TeachShell>
      )}
    </DetailColumn>
  );
}

function ProblemCard({
  problem,
  stats,
  studentCount,
  selected,
  onSelect,
}: {
  problem: CodingProblemSummary;
  stats?: ClassCodingProblemDto;
  studentCount: number;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <SidebarCard
      icon="ph-terminal-window"
      color={diffColor(problem.difficulty)}
      title={problem.title}
      meta={t('coding.reviewProgress', {
        submitted: stats?.submittedCount ?? 0,
        total: studentCount,
        passed: stats?.passedCount ?? 0,
      })}
      selected={selected}
      onClick={onSelect}
      tag={stats && !stats.isOpen ? <span className="tag tag-neutral">{t('coding.reviewLocked')}</span> : undefined}
    />
  );
}

/** Bảng học viên của một bài; bấm "Xem code" thì thay bảng bằng màn xem chi tiết. */
function ProblemSubmissions({ classId, problemId }: { classId: string; problemId: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const data = useClassProblemSubmissions(classId, problemId);
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null);

  if (data.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (!data.data) return <EmptyHint icon="ph-warning">{t('coding.reviewLoadFailed')}</EmptyHint>;

  const { problem, students } = data.data;
  const reviewing = students.find((s) => s.userId === reviewingUserId && s.submissions.length > 0);
  if (reviewing) {
    return <SubmissionReview student={reviewing} onBack={() => setReviewingUserId(null)} />;
  }

  return (
    <DetailColumn>
      <DetailHeader
        icon="ph-terminal-window"
        color={diffColor(problem.difficulty)}
        title={problem.title}
        meta={`${problem.language} · ${t('coding.scoreValue', { score: problem.maxScore })}`}
      />
      <DetailSection icon="ph-users-three" color="var(--cx-blue)" title={t('coding.reviewStudents')} count={students.length}>
        {students.length === 0 ? (
          <EmptyHint icon="ph-users-three">{t('coding.reviewNoStudents')}</EmptyHint>
        ) : (
          <div className="card" style={{ borderRadius: 20, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>{t('coding.colStudent')}</th>
                    <th>{t('coding.colAttempts')}</th>
                    <th>{t('coding.colBest')}</th>
                    <th>{t('coding.colLatest')}</th>
                    <th aria-label={t('coding.viewCode')} />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.userId}>
                      <td>
                        <p className="m-0" style={{ fontSize: 14 }}>
                          {s.fullName}
                        </p>
                        <p className="text-muted m-0" style={{ fontSize: 12 }}>
                          {s.email}
                        </p>
                        {!s.isActiveMember && <span className="tag tag-neutral">{t('coding.leftClass')}</span>}
                      </td>
                      <td>{s.attempts}</td>
                      <td>{s.bestScore === null ? '—' : `${s.bestScore}/${problem.maxScore}`}</td>
                      <td>
                        {s.latestStatus ? (
                          <div className="flex flex-col items-start gap-1">
                            <SubmissionStatusTag status={s.latestStatus} />
                            <span className="text-muted" style={{ fontSize: 12 }}>
                              {new Date(s.submissions[0].submittedAt).toLocaleString(i18n.language)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">{t('coding.notSubmitted')}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.attempts > 0 && (
                          <PillButton icon="ph-code" variant="secondary" onClick={() => setReviewingUserId(s.userId)}>
                            {t('coding.viewCode')}
                          </PillButton>
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
    </DetailColumn>
  );
}

function SubmissionReview({ student, onBack }: { student: ClassCodingStudentRowDto; onBack: () => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const [attemptId, setAttemptId] = useState(student.submissions[0].id);
  const review = useCodingSubmissionReview(attemptId);
  const data = review.data;
  const total = student.submissions.length;

  return (
    <DetailColumn>
      <div className="self-start">
        <PillButton icon="ph-arrow-left" variant="ghost" onClick={onBack}>
          {t('coding.reviewBack')}
        </PillButton>
      </div>

      <DetailHeader
        icon="ph-user"
        color="var(--cx-purple)"
        title={student.fullName}
        meta={data?.problemTitle}
        actions={
          <div className="field" style={{ minWidth: 260 }}>
            <label htmlFor="review-attempt">{t('coding.reviewAttempt')}</label>
            <select id="review-attempt" className="input" value={attemptId} onChange={(e) => setAttemptId(e.target.value)}>
              {student.submissions.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {t('coding.attemptOption', {
                    n: total - i,
                    time: new Date(s.submittedAt).toLocaleString(i18n.language),
                    status: t(`coding.status_${s.status}`, { defaultValue: s.status }),
                  })}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {data && (
          <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 14 }}>
            <SubmissionStatusTag status={data.status} />
            {data.score !== null && data.score !== undefined && (
              <span>
                {t('coding.score')}: <span className="font-semibold">{data.score}/{data.maxScore}</span>
              </span>
            )}
          </div>
        )}
      </DetailHeader>

      {review.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {review.isError && <EmptyHint icon="ph-warning">{t('coding.reviewLoadFailed')}</EmptyHint>}

      {data && (
        <>
          <DetailSection icon="ph-code" color="var(--cx-teal)" title={t('coding.reviewCode')}>
            <pre
              className="m-0 overflow-auto"
              style={{
                maxHeight: '60vh',
                borderRadius: 18,
                background: 'var(--color-neutral-900)',
                boxShadow: 'inset 0 0 0 1px var(--color-divider)',
                padding: 'var(--space-6)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {data.sourceCode}
            </pre>
          </DetailSection>

          <DetailSection icon="ph-flask" color="var(--cx-amber)" title={t('coding.reviewTests')} count={data.results.length}>
            {data.results.length === 0 ? (
              <EmptyHint icon="ph-flask">{t('coding.reviewNoResults')}</EmptyHint>
            ) : (
              data.results.map((r, i) => <TestResultCard key={r.id} result={r} index={i + 1} />)
            )}
          </DetailSection>
        </>
      )}
    </DetailColumn>
  );
}

function TestResultCard({ result, index }: { result: ReviewTestCaseResultDto; index: number }): JSX.Element {
  const { t } = useTranslation();
  const passed = result.status === 'passed';
  return (
    <div className="card" style={{ borderRadius: 18, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="cx-display flex shrink-0 items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            fontSize: 13,
            background: 'color-mix(in srgb, var(--cx-teal) 18%, transparent)',
            color: 'var(--cx-teal)',
          }}
        >
          {index}
        </span>
        <p className="m-0 min-w-0 flex-1 truncate" style={{ fontSize: 14 }}>
          {result.name || t('coding.tcName')}
        </p>
        <span className={result.kind === 'sample' ? 'tag tag-outline shrink-0' : 'tag tag-neutral shrink-0'}>
          {t(`coding.kind_${result.kind}`)}
        </span>
        <StatusTag ok={passed} label={t(`coding.tcstatus_${result.status}`, { defaultValue: result.status })} />
        {result.runtimeMs !== null && result.runtimeMs !== undefined && (
          <span className="text-muted shrink-0" style={{ fontSize: 11 }}>
            {t('coding.runtimeValue', { ms: result.runtimeMs })}
          </span>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <IoPanel label={t('coding.stdin')} value={result.stdin} />
        <IoPanel label={t('coding.expectedStdout')} value={result.expectedStdout} color="var(--cx-teal)" />
        <IoPanel label={t('coding.actualStdout')} value={result.actualStdout ?? ''} color={passed ? undefined : ERROR_COLOR} />
      </div>
    </div>
  );
}

function SubmissionStatusTag({ status }: { status: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <StatusTag
      ok={status === 'passed'}
      neutral={status === 'queued' || status === 'running'}
      label={t(`coding.status_${status}`, { defaultValue: status })}
    />
  );
}

function StatusTag({ ok, neutral, label }: { ok: boolean; neutral?: boolean; label: string }): JSX.Element {
  const cls = neutral ? 'tag tag-neutral' : ok ? 'tag tag-accent' : 'tag';
  const style = !neutral && !ok ? { background: `color-mix(in srgb, ${ERROR_COLOR} 22%, transparent)`, color: ERROR_COLOR } : undefined;
  return (
    <span className={`${cls} shrink-0`} style={style}>
      {label}
    </span>
  );
}
