import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import type { CodingProblemSummary, CodingSubmissionDto } from '@lms/contracts';
import '../../lib/monaco-setup';
import {
  useCodingAttempt,
  useCodingProblemsForClass,
  useCodingSubmission,
  useSubmitCoding,
} from '../../features/coding/hooks';
import { useSampleRunner, type SampleRunResult } from '../../features/coding/useSampleRunner';

const TERMINAL = new Set(['passed', 'failed', 'error']);

export function LearnCoding({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const problems = useCodingProblemsForClass(classId);
  const [openId, setOpenId] = useState<string | null>(null);

  // Đổi lớp → đóng bài đang mở.
  useEffect(() => {
    setOpenId(null);
  }, [classId]);

  if (openId) {
    return (
      <CodingWorkspace
        key={openId}
        problemId={openId}
        classId={classId}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <h2 className="text-base font-semibold text-slate-800">{t('coding.heading')}</h2>
      {problems.isLoading && <p className="text-xs text-slate-400">{t('common.loading')}</p>}
      {problems.isError && <p className="text-xs text-red-600">{t('common.error')}</p>}
      {problems.data && problems.data.length === 0 && (
        <p className="text-sm text-slate-500">{t('coding.noProblems')}</p>
      )}
      {problems.data && problems.data.length > 0 && (
        <ul className="space-y-2">
          {problems.data.map((p) => (
            <ProblemRow key={p.id} problem={p} onOpen={() => setOpenId(p.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProblemRow({
  problem,
  onOpen,
}: {
  problem: CodingProblemSummary;
  onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="font-medium">{problem.title}</p>
        <p className="text-xs text-slate-400">
          {t('coding.difficultyLabel')}: {t(`coding.diff_${problem.difficulty}`, { defaultValue: problem.difficulty })}
          {' · '}
          {t('coding.maxScore')}: {problem.maxScore}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
      >
        {t('coding.open')}
      </button>
    </li>
  );
}

function CodingWorkspace({
  problemId,
  classId,
  onBack,
}: {
  problemId: string;
  classId: string;
  onBack: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const attempt = useCodingAttempt(problemId, classId);
  const { run, running } = useSampleRunner();
  const submit = useSubmitCoding(problemId);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const submission = useCodingSubmission(submissionId);

  const [code, setCode] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [sampleResults, setSampleResults] = useState<SampleRunResult[] | null>(null);
  const [runnerError, setRunnerError] = useState(false);

  // Nạp starter code một lần khi đề tải xong.
  useEffect(() => {
    if (attempt.data && !seeded) {
      setCode(attempt.data.starterCode ?? '');
      setSeeded(true);
    }
  }, [attempt.data, seeded]);

  const onRun = async () => {
    setRunnerError(false);
    try {
      const res = await run(code, attempt.data?.sampleTests ?? []);
      setSampleResults(res);
    } catch {
      setRunnerError(true);
    }
  };

  const onSubmit = () => {
    setSubmissionId(null);
    submit.mutate(
      { classId, sourceCode: code },
      { onSuccess: (dto) => setSubmissionId(dto.id) },
    );
  };

  const sub = submission.data;
  const isGrading =
    submit.isPending || (!!submissionId && (!sub || !TERMINAL.has(sub.status)));
  const samplePassed = sampleResults?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800">
        {t('coding.back')}
      </button>

      {attempt.isLoading && <p className="text-sm text-slate-400">{t('common.loading')}</p>}
      {attempt.isError && <p className="text-sm text-red-600">{t('common.error')}</p>}

      {attempt.data && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{attempt.data.title}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{attempt.data.statementMd}</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{t('coding.sourceCode')}</label>
            <div className="overflow-hidden rounded border border-slate-300">
              <Editor
                height="360px"
                language="python"
                theme="light"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  tabSize: 4,
                  lineNumbers: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRun}
              disabled={running}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              {running ? t('coding.running') : t('coding.run')}
            </button>
            <button
              onClick={onSubmit}
              disabled={submit.isPending || isGrading}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submit.isPending ? t('coding.submitting') : t('coding.submit')}
            </button>
          </div>
          <p className="text-xs text-slate-400">{t('coding.previewNote')}</p>

          <SamplePreview
            results={sampleResults}
            total={attempt.data.sampleTests.length}
            passed={samplePassed}
            error={runnerError}
          />

          <SubmissionResult isGrading={isGrading} submission={sub} />
        </>
      )}
    </div>
  );
}

function SamplePreview({
  results,
  total,
  passed,
  error,
}: {
  results: SampleRunResult[] | null;
  total: number;
  passed: number;
  error: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (error) {
    return <p className="text-sm text-red-600">{t('coding.runnerError')}</p>;
  }
  if (!results) return null;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium text-slate-700">
        {t('coding.samplePreviewHeading')} · {t('coding.samplePassed', { passed, total })}
      </p>
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.order} className="rounded border border-slate-100 bg-slate-50 p-2 text-xs">
            <div className="flex items-center gap-2">
              <StatusPill ok={r.passed} label={r.passed ? t('coding.tcstatus_passed') : t('coding.tcstatus_failed')} />
              <span className="text-slate-500">{r.name || `#${r.order + 1}`}</span>
            </div>
            {r.error ? (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-red-600">{r.error}</pre>
            ) : (
              !r.passed && (
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-slate-600">
                  {t('coding.actual')}: {r.actualStdout || '∅'}
                </pre>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubmissionResult({
  isGrading,
  submission,
}: {
  isGrading: boolean;
  submission?: CodingSubmissionDto;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!isGrading && !submission) return null;
  return (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <p className="text-sm font-medium text-slate-700">{t('coding.yourResult')}</p>
      {isGrading && !submission ? (
        <p className="text-sm text-amber-600">{t('coding.grading')}</p>
      ) : submission ? (
        <>
          <div className="flex items-center gap-3 text-sm">
            <StatusPill
              ok={submission.status === 'passed'}
              neutral={submission.status === 'queued' || submission.status === 'running'}
              label={t(`coding.status_${submission.status}`, { defaultValue: submission.status })}
            />
            {submission.score != null && (
              <span className="text-slate-700">
                {t('coding.score')}: <span className="font-semibold">{submission.score}</span>
              </span>
            )}
            {isGrading && <span className="text-xs text-amber-600">{t('coding.grading')}</span>}
          </div>
          {submission.results && submission.results.length > 0 && (
            <ul className="space-y-1">
              {submission.results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded border border-slate-100 bg-white px-2 py-1 text-xs"
                >
                  <StatusPill
                    ok={r.status === 'passed'}
                    label={t(`coding.tcstatus_${r.status}`, { defaultValue: r.status })}
                  />
                  <span className="text-slate-500">{r.name || `#${r.order + 1}`}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatusPill({
  ok,
  neutral,
  label,
}: {
  ok: boolean;
  neutral?: boolean;
  label: string;
}): JSX.Element {
  const cls = neutral
    ? 'bg-slate-100 text-slate-500'
    : ok
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-red-100 text-red-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
