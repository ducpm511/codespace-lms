import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AuthorTestCaseDto,
  CodingDifficultyValue,
  CodingProblemAuthorDetail,
  TestCaseKindValue,
} from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useCourses, useCourse } from '../../features/courses/hooks';
import {
  useCodingProblem,
  useCodingProblems,
  useCreateCodingProblem,
  useDeleteCodingProblem,
  useDeleteTestCase,
  useUpsertTestCase,
} from '../../features/coding/hooks';
import { MarkdownBlock } from '../../features/lesson-activities/ActivityBlocks';
import {
  DetailColumn,
  DetailHeader,
  DetailSection,
  EmptyHint,
  IconButton,
  PillButton,
  Sidebar,
  SidebarCard,
  TeachShell,
} from './teachUi';

const ERROR_COLOR = '#f4a3a3';

/** Màu category theo độ khó. */
const DIFF_COLOR: Record<string, string> = {
  easy: 'var(--cx-teal)',
  medium: 'var(--cx-amber)',
  hard: 'var(--cx-coral)',
};
const diffColor = (d: string) => DIFF_COLOR[d] ?? 'var(--cx-purple)';

export function TeachCoding(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeCourseId = courseId || courses.data?.items[0]?.id || '';
  const problems = useCodingProblems(activeCourseId || undefined);

  return (
    <DetailColumn>
      <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)' }}>
        <div className="field max-w-md">
          <label>{t('assignments.selectCourse')}</label>
          <select
            className="input"
            value={activeCourseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setSelectedId(null);
            }}
          >
            {courses.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TeachShell
        sidebar={
          <Sidebar
            icon="ph-code"
            color="var(--cx-teal)"
            title={t('coding.heading')}
            count={problems.data?.items.length}
            footer={
              creating && activeCourseId ? (
                <CreateProblemForm
                  courseId={activeCourseId}
                  onCancel={() => setCreating(false)}
                  onCreated={(id) => {
                    setSelectedId(id);
                    setCreating(false);
                  }}
                />
              ) : (
                <PillButton icon="ph-plus" disabled={!activeCourseId} onClick={() => setCreating(true)}>
                  {t('coding.create')}
                </PillButton>
              )
            }
          >
            {problems.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
            {!activeCourseId && <EmptyHint icon="ph-books">{t('assignments.selectCourse')}</EmptyHint>}
            {activeCourseId && problems.data?.items.length === 0 && (
              <EmptyHint icon="ph-code">{t('coding.empty')}</EmptyHint>
            )}
            {problems.data?.items.map((p) => (
              <SidebarCard
                key={p.id}
                icon="ph-terminal-window"
                color={diffColor(p.difficulty)}
                title={p.title}
                meta={`${p.language} · ${t('coding.scoreValue', { score: p.maxScore })}`}
                selected={selectedId === p.id}
                onClick={() => setSelectedId(p.id)}
                tag={<DifficultyTag difficulty={p.difficulty} />}
              />
            ))}
          </Sidebar>
        }
      >
        {selectedId ? (
          <ProblemEditor problemId={selectedId} courseId={activeCourseId} onDeleted={() => setSelectedId(null)} />
        ) : (
          <EmptyHint icon="ph-hand-pointing">{t('coding.selectHint')}</EmptyHint>
        )}
      </TeachShell>
    </DetailColumn>
  );
}

function DifficultyTag({ difficulty }: { difficulty: string }): JSX.Element {
  const { t } = useTranslation();
  const color = diffColor(difficulty);
  return (
    <span
      className="shrink-0"
      style={{
        borderRadius: 999,
        padding: '3px 10px',
        fontSize: 11,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    >
      {t(`coding.diff_${difficulty}`, { defaultValue: difficulty })}
    </span>
  );
}

function CreateProblemForm({
  courseId,
  onCreated,
  onCancel,
}: {
  courseId: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const course = useCourse(courseId);
  const create = useCreateCodingProblem();

  const [title, setTitle] = useState('');
  const [statementMd, setStatementMd] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [difficulty, setDifficulty] = useState<CodingDifficultyValue>('easy');
  const [maxScore, setMaxScore] = useState(100);

  const lessons = (course.data?.sections ?? []).flatMap((s) =>
    (s.lessons ?? []).map((l) => ({ id: l.id, title: l.title })),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        courseId,
        title: title.trim(),
        statementMd: statementMd.trim(),
        lessonId: lessonId || undefined,
        difficulty,
        maxScore: Number(maxScore),
        language: 'python',
      },
      {
        onSuccess: (p) => {
          setTitle('');
          setStatementMd('');
          setLessonId('');
          onCreated(p.id);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="card gap-2" style={{ borderRadius: 18 }}>
      <p className="cx-display m-0" style={{ fontSize: 14 }}>
        {t('coding.create')}
      </p>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('coding.title')}
        required
      />
      <textarea
        className="input text-xs"
        value={statementMd}
        onChange={(e) => setStatementMd(e.target.value)}
        placeholder={t('coding.statement')}
        rows={3}
        required
      />
      <div className="field">
        <label>{t('coding.lesson')}</label>
        <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          <option value="">{t('coding.noLesson')}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="field flex-1">
          <label>{t('coding.difficulty')}</label>
          <select
            className="input"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as CodingDifficultyValue)}
          >
            <option value="easy">{t('coding.diff_easy')}</option>
            <option value="medium">{t('coding.diff_medium')}</option>
            <option value="hard">{t('coding.diff_hard')}</option>
          </select>
        </div>
        <div className="field flex-1">
          <label>{t('coding.maxScore')}</label>
          <input
            className="input"
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <PillButton type="submit" icon="ph-plus" disabled={create.isPending}>
          {t('coding.add')}
        </PillButton>
        <PillButton variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </PillButton>
      </div>
      {create.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(create.error)}</p>}
    </form>
  );
}

function ProblemEditor({
  problemId,
  courseId,
  onDeleted,
}: {
  problemId: string;
  courseId: string;
  onDeleted: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const problem = useCodingProblem(problemId);
  const course = useCourse(courseId || null);
  const del = useDeleteCodingProblem(courseId);

  if (problem.isLoading || !problem.data) {
    return <p className="text-muted text-sm">{t('common.loading')}</p>;
  }
  const p = problem.data;
  const lessonTitle = (course.data?.sections ?? [])
    .flatMap((s) => s.lessons ?? [])
    .find((l) => l.id === p.lessonId)?.title;

  return (
    <DetailColumn>
      <DetailHeader
        icon="ph-terminal-window"
        color={diffColor(p.difficulty)}
        title={p.title}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span>{p.language}</span>
            <span aria-hidden>·</span>
            <span>{t('coding.scoreValue', { score: p.maxScore })}</span>
            <span aria-hidden>·</span>
            <span>{p.timeLimitMs}ms · {p.memoryLimitMb}MB</span>
            {lessonTitle && (
              <>
                <span aria-hidden>·</span>
                <span>{t('coding.lessonLabel', { title: lessonTitle })}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <DifficultyTag difficulty={p.difficulty} />
            <PillButton
              icon="ph-trash"
              variant="secondary"
              onClick={() => {
                if (confirm(t('coding.confirmDelete'))) del.mutate(p.id, { onSuccess: onDeleted });
              }}
            >
              {t('coding.delete')}
            </PillButton>
          </>
        }
      />

      <DetailSection icon="ph-article" color="var(--cx-blue)" title={t('coding.statementHeading')}>
        <div
          style={{
            borderRadius: 18,
            background: 'var(--color-neutral-900)',
            boxShadow: 'inset 0 0 0 1px var(--color-divider)',
            padding: 'var(--space-6)',
          }}
        >
          <MarkdownBlock content={p.statementMd} />
        </div>
      </DetailSection>

      <TestCasesManager problem={p} />
    </DetailColumn>
  );
}

function TestCasesManager({ problem }: { problem: CodingProblemAuthorDetail }): JSX.Element {
  const { t } = useTranslation();
  const del = useDeleteTestCase(problem.id);
  const [editing, setEditing] = useState<AuthorTestCaseDto | null>(null);

  return (
    <DetailSection
      icon="ph-flask"
      color="var(--cx-teal)"
      title={t('coding.testcases')}
      count={problem.testCases.length}
      action={
        !editing && (
          <PillButton
            icon="ph-plus"
            variant="secondary"
            onClick={() =>
              setEditing({ id: '', name: '', stdin: '', expectedStdout: '', kind: 'sample', weight: 1, order: 0 })
            }
          >
            {t('coding.addTestcase')}
          </PillButton>
        )
      }
    >
      {editing && <TestCaseForm problemId={problem.id} initial={editing} onClose={() => setEditing(null)} />}

      {problem.testCases.length === 0 && !editing && <EmptyHint icon="ph-flask">{t('coding.noTestcase')}</EmptyHint>}

      {problem.testCases.map((tc, i) => (
        <TestCaseCard key={tc.id} testCase={tc} index={i + 1} onEdit={() => setEditing(tc)} onDelete={() => del.mutate(tc.id)} />
      ))}
    </DetailSection>
  );
}

function TestCaseCard({
  testCase,
  index,
  onEdit,
  onDelete,
}: {
  testCase: AuthorTestCaseDto;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const isSample = testCase.kind === 'sample';

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
          {testCase.name || t('coding.tcName')}
        </p>
        <span className={isSample ? 'tag tag-outline shrink-0' : 'tag tag-neutral shrink-0'}>
          {isSample ? t('coding.kindSampleLong') : t('coding.kindHiddenLong')}
        </span>
        <span className="text-muted shrink-0" style={{ fontSize: 11 }}>
          {t('coding.weightLabel', { weight: testCase.weight })}
        </span>
        <IconButton icon="ph-pencil-simple" title={t('coding.edit')} onClick={onEdit} />
        <IconButton icon="ph-trash" tone="danger" title={t('coding.delete')} onClick={onDelete} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <IoPanel label={t('coding.stdin')} value={testCase.stdin} />
        <IoPanel label={t('coding.expectedStdout')} value={testCase.expectedStdout} color="var(--cx-teal)" />
      </div>
    </div>
  );
}

function IoPanel({ label, value, color }: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <div
      style={{
        borderRadius: 14,
        background: 'var(--color-neutral-900)',
        boxShadow: 'inset 0 0 0 1px var(--color-divider)',
        padding: 'var(--space-4)',
      }}
    >
      <p className="text-muted m-0" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <pre
        className="m-0 overflow-x-auto"
        style={{
          marginTop: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          color: color ?? 'var(--color-text)',
        }}
      >
        {value || '—'}
      </pre>
    </div>
  );
}

function TestCaseForm({
  problemId,
  initial,
  onClose,
}: {
  problemId: string;
  initial: AuthorTestCaseDto;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const upsert = useUpsertTestCase(problemId);
  const [name, setName] = useState(initial.name ?? '');
  const [kind, setKind] = useState<TestCaseKindValue>(initial.kind);
  const [stdin, setStdin] = useState(initial.stdin);
  const [expectedStdout, setExpectedStdout] = useState(initial.expectedStdout);
  const [weight, setWeight] = useState(initial.weight);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    upsert.mutate(
      {
        id: initial.id || undefined,
        name: name.trim() || undefined,
        stdin,
        expectedStdout,
        kind,
        weight: Number(weight),
        order: initial.id ? initial.order : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ borderRadius: 18, padding: 'var(--space-6)', gap: 'var(--space-4)', outline: '1px solid var(--color-accent-700)' }}
    >
      <p className="cx-display m-0" style={{ fontSize: 14 }}>
        {initial.id ? t('coding.editTestcase') : t('coding.addTestcase')}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="input min-w-[140px] flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('coding.tcName')}
        />
        <select className="input w-28" value={kind} onChange={(e) => setKind(e.target.value as TestCaseKindValue)}>
          <option value="sample">{t('coding.kind_sample')}</option>
          <option value="hidden">{t('coding.kind_hidden')}</option>
        </select>
        <input
          className="input w-20"
          type="number"
          step="0.5"
          min={0}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          title={t('coding.weight')}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label>{t('coding.stdin')}</label>
          <textarea
            className="input font-mono text-[11px]"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={3}
          />
        </div>
        <div className="field">
          <label>{t('coding.expectedStdout')}</label>
          <textarea
            className="input font-mono text-[11px]"
            value={expectedStdout}
            onChange={(e) => setExpectedStdout(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <PillButton type="submit" icon="ph-check" disabled={upsert.isPending}>
          {t('coding.save')}
        </PillButton>
        <PillButton variant="secondary" onClick={onClose}>
          {t('coding.cancel')}
        </PillButton>
      </div>
      {upsert.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(upsert.error)}</p>}
    </form>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
