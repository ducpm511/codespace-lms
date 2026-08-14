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

  useEffect(() => {
    setOpenId(null);
  }, [classId]);

  if (openId) {
    return <CodingWorkspace key={openId} problemId={openId} classId={classId} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="nocturne-surface space-y-3 rounded-lg p-4">
      <h2 className="text-base">{t('coding.heading')}</h2>
      {problems.isLoading && <p className="text-muted text-xs">{t('common.loading')}</p>}
      {problems.isError && <p className="text-xs text-red-400">{t('common.error')}</p>}
      {problems.data && problems.data.length === 0 && (
        <p className="text-muted text-sm">{t('coding.noProblems')}</p>
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

function ProblemRow({ problem, onOpen }: { problem: CodingProblemSummary; onOpen: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <li className="card flex-row flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="card-title truncate">{problem.title}</p>
        <p className="card-meta">
          {t('coding.difficultyLabel')}: {t(`coding.diff_${problem.difficulty}`, { defaultValue: problem.difficulty })}
          {' · '}
          {t('coding.maxScore')}: {problem.maxScore}
        </p>
      </div>
      <button onClick={onOpen} className="btn btn-primary shrink-0">
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
    submit.mutate({ classId, sourceCode: code }, { onSuccess: (dto) => setSubmissionId(dto.id) });
  };

  const sub = submission.data;
  const isGrading = submit.isPending || (!!submissionId && (!sub || !TERMINAL.has(sub.status)));
  const samplePassed = sampleResults?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="nocturne-surface space-y-4 rounded-lg p-4">
      <button onClick={onBack} className="btn btn-ghost">
        {t('coding.back')}
      </button>

      {attempt.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {attempt.isError && <p className="text-sm text-red-400">{t('common.error')}</p>}

      {attempt.data && (
        <>
          <div>
            <h2 className="text-lg">{attempt.data.title}</h2>
            <p className="text-muted whitespace-pre-wrap text-sm">{attempt.data.statementMd}</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('coding.sourceCode')}</label>
            <div className="overflow-hidden rounded-md" style={{ border: '1px solid var(--color-divider)' }}>
              <Editor
                height="360px"
                language="python"
                theme="vs-dark"
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
            <button onClick={onRun} disabled={running} className="btn btn-secondary">
              {running ? t('coding.running') : t('coding.run')}
            </button>
            <button onClick={onSubmit} disabled={submit.isPending || isGrading} className="btn btn-primary">
              {submit.isPending ? t('coding.submitting') : t('coding.submit')}
            </button>
          </div>
          <p className="text-muted text-xs">{t('coding.previewNote')}</p>

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
    return <p className="text-sm text-red-400">{t('coding.runnerError')}</p>;
  }
  if (!results) return null;
  return (
    <div className="card gap-2">
      <p className="text-sm font-medium">
        {t('coding.samplePreviewHeading')} · {t('coding.samplePassed', { passed, total })}
      </p>
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.order} className="chip text-xs">
            <div className="flex items-center gap-2">
              <StatusPill ok={r.passed} label={r.passed ? t('coding.tcstatus_passed') : t('coding.tcstatus_failed')} />
              <span className="text-muted">{r.name || `#${r.order + 1}`}</span>
            </div>
            {r.error ? (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-red-400">{r.error}</pre>
            ) : (
              !r.passed && (
                <pre className="text-muted mt-1 overflow-x-auto whitespace-pre-wrap">
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
  const passed = submission?.status === 'passed';
  return (
    <div
      className="card gap-2"
      style={passed ? { background: 'var(--color-accent-900)', boxShadow: 'inset 0 0 0 1px var(--color-accent-700)' } : undefined}
    >
      <p className="text-sm font-medium">{t('coding.yourResult')}</p>
      {isGrading && !submission ? (
        <p className="text-sm" style={{ color: 'var(--color-accent-300)' }}>{t('coding.grading')}</p>
      ) : submission ? (
        <>
          <div className="flex items-center gap-3 text-sm">
            <StatusPill
              ok={submission.status === 'passed'}
              neutral={submission.status === 'queued' || submission.status === 'running'}
              label={t(`coding.status_${submission.status}`, { defaultValue: submission.status })}
            />
            {submission.score != null && (
              <span>
                {t('coding.score')}: <span className="font-semibold">{submission.score}</span>
              </span>
            )}
            {isGrading && <span className="text-xs" style={{ color: 'var(--color-accent-300)' }}>{t('coding.grading')}</span>}
          </div>
          {submission.results && submission.results.length > 0 && (
            <ul className="space-y-1">
              {submission.results.map((r) => (
                <li key={r.id} className="chip flex items-center gap-2 text-xs">
                  <StatusPill ok={r.status === 'passed'} label={t(`coding.tcstatus_${r.status}`, { defaultValue: r.status })} />
                  <span className="text-muted">{r.name || `#${r.order + 1}`}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ ok, neutral, label }: { ok: boolean; neutral?: boolean; label: string }): JSX.Element {
  const cls = neutral ? 'tag tag-neutral' : ok ? 'tag tag-accent' : 'tag';
  const style = !neutral && !ok ? { background: 'color-mix(in srgb, #f4a3a3 22%, transparent)', color: '#f4a3a3' } : undefined;
  return (
    <span className={cls} style={style}>
      {label}
    </span>
  );
}
