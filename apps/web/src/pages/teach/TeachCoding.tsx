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

const dividerBorder = { borderColor: 'var(--color-divider)' } as const;
const selectedBg = { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' } as const;

export function TeachCoding(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeCourseId = courseId || courses.data?.items[0]?.id || '';

  return (
    <div className="space-y-4">
      <div className="field card max-w-md">
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

      <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          {activeCourseId && (
            <CreateProblemForm courseId={activeCourseId} onCreated={(id) => setSelectedId(id)} />
          )}
          <div className="panel overflow-hidden">
            <div className="panel-head">{t('coding.heading')}</div>
            {!activeCourseId ? (
              <p className="text-muted px-3 py-4 text-xs">{t('assignments.selectCourse')}</p>
            ) : (
              <ProblemsList courseId={activeCourseId} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>
        </div>

        <div>
          {selectedId ? (
            <ProblemEditor problemId={selectedId} courseId={activeCourseId} onDeleted={() => setSelectedId(null)} />
          ) : (
            <p className="text-muted rounded-lg border border-dashed px-4 py-12 text-center text-sm" style={dividerBorder}>
              {t('coding.selectHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateProblemForm({
  courseId,
  onCreated,
}: {
  courseId: string;
  onCreated: (id: string) => void;
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
    <form onSubmit={submit} className="card gap-2">
      <p className="card-title">{t('coding.create')}</p>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('coding.title')} required />
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
          <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as CodingDifficultyValue)}>
            <option value="easy">{t('coding.diff_easy')}</option>
            <option value="medium">{t('coding.diff_medium')}</option>
            <option value="hard">{t('coding.diff_hard')}</option>
          </select>
        </div>
        <div className="field flex-1">
          <label>{t('coding.maxScore')}</label>
          <input className="input" type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
        </div>
      </div>
      <button type="submit" disabled={create.isPending} className="btn btn-primary btn-block">
        {t('coding.add')}
      </button>
      {create.isError && <p className="text-xs text-red-400">{errMsg(create.error)}</p>}
    </form>
  );
}

function ProblemsList({
  courseId,
  selectedId,
  onSelect,
}: {
  courseId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const problems = useCodingProblems(courseId);

  if (problems.isLoading) return <p className="text-muted px-3 py-4 text-xs">{t('common.loading')}</p>;
  if (problems.data?.items.length === 0) {
    return <p className="text-muted px-3 py-4 text-xs">{t('coding.empty')}</p>;
  }

  return (
    <ul>
      {problems.data?.items.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onSelect(p.id)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
            style={selectedId === p.id ? selectedBg : undefined}
          >
            <p className="truncate font-medium">{p.title}</p>
            <p className="text-muted text-xs">
              {p.language} · {t(`coding.diff_${p.difficulty}`, { defaultValue: p.difficulty })} · {p.maxScore}đ
            </p>
          </button>
        </li>
      ))}
    </ul>
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
  const del = useDeleteCodingProblem(courseId);

  if (problem.isLoading || !problem.data) {
    return <p className="text-muted text-sm">{t('common.loading')}</p>;
  }
  const p = problem.data;

  return (
    <div className="space-y-4">
      <div className="card gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base">{p.title}</h2>
            <p className="text-muted text-xs">
              {p.language} · {t(`coding.diff_${p.difficulty}`, { defaultValue: p.difficulty })} ·{' '}
              {t('coding.maxScore')}: {p.maxScore} · {p.timeLimitMs}ms · {p.memoryLimitMb}MB
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm(t('coding.confirmDelete'))) del.mutate(p.id, { onSuccess: onDeleted });
            }}
            className="btn btn-danger shrink-0"
          >
            {t('coding.delete')}
          </button>
        </div>
        <div>
          <p className="text-muted text-xs font-medium">{t('coding.statement')}</p>
          <pre className="chip mt-1 whitespace-pre-wrap text-xs">{p.statementMd}</pre>
        </div>
      </div>

      <TestCasesManager problem={p} />
    </div>
  );
}

function TestCasesManager({ problem }: { problem: CodingProblemAuthorDetail }): JSX.Element {
  const { t } = useTranslation();
  const del = useDeleteTestCase(problem.id);
  const [editing, setEditing] = useState<AuthorTestCaseDto | null>(null);

  const samples = problem.testCases.filter((c) => c.kind === 'sample');
  const hidden = problem.testCases.filter((c) => c.kind === 'hidden');

  return (
    <div className="card gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base">{t('coding.testcases')}</h3>
        <button
          onClick={() => setEditing({ id: '', name: '', stdin: '', expectedStdout: '', kind: 'sample', weight: 1, order: 0 })}
          className="btn btn-primary"
        >
          {t('coding.addTestcase')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TestCaseGroup label={t('coding.sampleTests')} hint={t('coding.sampleHint')} items={samples} onEdit={setEditing} onDelete={(id) => del.mutate(id)} />
        <TestCaseGroup label={t('coding.hiddenTests')} hint={t('coding.hiddenHint')} items={hidden} onEdit={setEditing} onDelete={(id) => del.mutate(id)} />
      </div>

      {editing && <TestCaseForm problemId={problem.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TestCaseGroup({
  label,
  hint,
  items,
  onEdit,
  onDelete,
}: {
  label: string;
  hint: string;
  items: AuthorTestCaseDto[];
  onEdit: (tc: AuthorTestCaseDto) => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-muted mb-1 text-[10px]">{hint}</p>
      {items.length === 0 ? (
        <p className="text-muted rounded border border-dashed p-3 text-center text-[11px]" style={dividerBorder}>
          {t('coding.noTestcase')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((tc) => (
            <li key={tc.id} className="rounded p-2 text-xs" style={{ border: '1px solid var(--color-divider)' }}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  #{tc.order} {tc.name || ''} · w{tc.weight}
                </span>
                <span className="flex gap-2">
                  <button onClick={() => onEdit(tc)} className="btn btn-ghost">
                    {t('coding.edit')}
                  </button>
                  <button onClick={() => onDelete(tc.id)} className="btn btn-ghost btn-danger">
                    {t('coding.delete')}
                  </button>
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <pre className="chip overflow-x-auto text-[10px]">in: {tc.stdin}</pre>
                <pre className="chip overflow-x-auto text-[10px]">out: {tc.expectedStdout}</pre>
              </div>
            </li>
          ))}
        </ul>
      )}
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
    <form onSubmit={submit} className="space-y-2 rounded-md p-3" style={{ background: 'var(--color-neutral-900)', boxShadow: 'inset 0 0 0 1px var(--color-divider)' }}>
      <p className="text-xs font-semibold">{initial.id ? t('coding.editTestcase') : t('coding.addTestcase')}</p>
      <div className="flex gap-2">
        <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('coding.tcName')} />
        <select className="input w-28" value={kind} onChange={(e) => setKind(e.target.value as TestCaseKindValue)}>
          <option value="sample">{t('coding.kind_sample')}</option>
          <option value="hidden">{t('coding.kind_hidden')}</option>
        </select>
        <input className="input w-16" type="number" step="0.5" min={0} value={weight} onChange={(e) => setWeight(Number(e.target.value))} title={t('coding.weight')} />
      </div>
      <div className="field">
        <label>{t('coding.stdin')}</label>
        <textarea className="input font-mono text-[11px]" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={2} />
      </div>
      <div className="field">
        <label>{t('coding.expectedStdout')}</label>
        <textarea className="input font-mono text-[11px]" value={expectedStdout} onChange={(e) => setExpectedStdout(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={upsert.isPending} className="btn btn-primary">
          {t('coding.save')}
        </button>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          {t('coding.cancel')}
        </button>
      </div>
      {upsert.isError && <p className="text-[10px] text-red-400">{errMsg(upsert.error)}</p>}
    </form>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
