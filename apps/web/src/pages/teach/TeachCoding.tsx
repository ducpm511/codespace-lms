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

export function TeachCoding(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeCourseId = courseId || courses.data?.items[0]?.id || '';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {t('assignments.selectCourse')}
        </label>
        <select
          value={activeCourseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setSelectedId(null);
          }}
          className="w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-sm"
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
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-sm font-medium">
              {t('coding.heading')}
            </div>
            {!activeCourseId ? (
              <p className="px-3 py-4 text-xs text-slate-400">{t('assignments.selectCourse')}</p>
            ) : (
              <ProblemsList
                courseId={activeCourseId}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </div>

        <div>
          {selectedId ? (
            <ProblemEditor problemId={selectedId} courseId={activeCourseId} onDeleted={() => setSelectedId(null)} />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
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
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium">{t('coding.create')}</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('coding.title')}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <textarea
        value={statementMd}
        onChange={(e) => setStatementMd(e.target.value)}
        placeholder={t('coding.statement')}
        rows={3}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
      />
      <div>
        <label className="block text-[10px] text-slate-500">{t('coding.lesson')}</label>
        <select
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="">{t('coding.noLesson')}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-slate-500">{t('coding.difficulty')}</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as CodingDifficultyValue)}
            className="w-full rounded border border-slate-300 px-1 py-1 text-xs"
          >
            <option value="easy">{t('coding.diff_easy')}</option>
            <option value="medium">{t('coding.diff_medium')}</option>
            <option value="hard">{t('coding.diff_hard')}</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] text-slate-500">{t('coding.maxScore')}</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={create.isPending}
        className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {t('coding.add')}
      </button>
      {create.isError && <p className="text-xs text-red-600">{errMsg(create.error)}</p>}
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

  if (problems.isLoading) return <p className="px-3 py-4 text-xs text-slate-400">{t('common.loading')}</p>;
  if (problems.data?.items.length === 0) {
    return <p className="px-3 py-4 text-xs text-slate-400">{t('coding.empty')}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {problems.data?.items.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onSelect(p.id)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
              selectedId === p.id ? 'bg-slate-100 font-medium' : ''
            }`}
          >
            <p className="truncate font-medium">{p.title}</p>
            <p className="text-xs text-slate-400">
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
    return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  }
  const p = problem.data;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold">{p.title}</h2>
            <p className="text-xs text-slate-400">
              {p.language} · {t(`coding.diff_${p.difficulty}`, { defaultValue: p.difficulty })} ·{' '}
              {t('coding.maxScore')}: {p.maxScore} · {p.timeLimitMs}ms · {p.memoryLimitMb}MB
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm(t('coding.confirmDelete'))) {
                del.mutate(p.id, { onSuccess: onDeleted });
              }
            }}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            {t('coding.delete')}
          </button>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">{t('coding.statement')}</p>
          <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{p.statementMd}</pre>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-sm font-semibold">{t('coding.testcases')}</h3>
        <button
          onClick={() => setEditing({ id: '', name: '', stdin: '', expectedStdout: '', kind: 'sample', weight: 1, order: 0 })}
          className="rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800"
        >
          {t('coding.addTestcase')}
        </button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <TestCaseGroup
          label={t('coding.sampleTests')}
          hint={t('coding.sampleHint')}
          items={samples}
          onEdit={setEditing}
          onDelete={(id) => del.mutate(id)}
        />
        <TestCaseGroup
          label={t('coding.hiddenTests')}
          hint={t('coding.hiddenHint')}
          items={hidden}
          onEdit={setEditing}
          onDelete={(id) => del.mutate(id)}
        />
      </div>

      {editing && (
        <TestCaseForm
          problemId={problem.id}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
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
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mb-1 text-[10px] text-slate-400">{hint}</p>
      {items.length === 0 ? (
        <p className="rounded border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
          {t('coding.noTestcase')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((tc) => (
            <li key={tc.id} className="rounded border border-slate-200 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">
                  #{tc.order} {tc.name || ''} · w{tc.weight}
                </span>
                <span className="flex gap-2">
                  <button onClick={() => onEdit(tc)} className="text-slate-500 hover:text-slate-800">
                    {t('coding.edit')}
                  </button>
                  <button onClick={() => onDelete(tc.id)} className="text-red-500 hover:text-red-700">
                    {t('coding.delete')}
                  </button>
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <pre className="overflow-x-auto rounded bg-slate-50 p-1 text-[10px]">in: {tc.stdin}</pre>
                <pre className="overflow-x-auto rounded bg-slate-50 p-1 text-[10px]">out: {tc.expectedStdout}</pre>
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
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <p className="text-xs font-semibold">{initial.id ? t('coding.editTestcase') : t('coding.addTestcase')}</p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('coding.tcName')}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TestCaseKindValue)}
          className="rounded border border-slate-300 px-1 py-1 text-xs"
        >
          <option value="sample">{t('coding.kind_sample')}</option>
          <option value="hidden">{t('coding.kind_hidden')}</option>
        </select>
        <input
          type="number"
          step="0.5"
          min={0}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          title={t('coding.weight')}
          className="w-16 rounded border border-slate-300 px-1 py-1 text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] text-slate-500">{t('coding.stdin')}</label>
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
        />
      </div>
      <div>
        <label className="block text-[10px] text-slate-500">{t('coding.expectedStdout')}</label>
        <textarea
          value={expectedStdout}
          onChange={(e) => setExpectedStdout(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={upsert.isPending}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {t('coding.save')}
        </button>
        <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-xs">
          {t('coding.cancel')}
        </button>
      </div>
      {upsert.isError && <p className="text-[10px] text-red-600">{errMsg(upsert.error)}</p>}
    </form>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
