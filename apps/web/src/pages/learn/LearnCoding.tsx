import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import type { CodingSubmissionDto } from '@lms/contracts';
import '../../lib/monaco-setup';
import { useCodingAttempt, useCodingSubmission, useSubmitCoding } from '../../features/coding/hooks';
import { useSampleRunner, type SampleRunResult } from '../../features/coding/useSampleRunner';

const TERMINAL = new Set(['passed', 'failed', 'error']);

/** Không gian làm bài lập trình (mở từ hub Bài tập — openId pattern). Giữ Monaco + Pyodide, chỉ re-skin chrome. */
export function LearnCodingWorkspace({
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
    <div className="space-y-4">
      <button onClick={onBack} className="btn btn-ghost cx-press self-start">
        <i className="ph ph-arrow-left" aria-hidden /> {t('coding.backList')}
      </button>

      {attempt.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {attempt.isError && <p className="text-sm text-red-400">{t('common.error')}</p>}

      {attempt.data && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Cột trái: đề + test mẫu + trạng thái */}
          <div className="space-y-4">
            <div>
              <h1 className="cx-display text-2xl">{attempt.data.title}</h1>
              <p className="text-muted mt-1 whitespace-pre-wrap text-sm">{attempt.data.statementMd}</p>
            </div>

            {attempt.data.sampleTests.length > 0 && (
              <div className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
                <p className="cx-display" style={{ fontSize: 15 }}>{t('coding.sampleTests')}</p>
                <ul className="space-y-1.5">
                  {attempt.data.sampleTests.map((s, i) => (
                    <li key={i} className="chip grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted">{t('coding.stdin')}</span>
                        <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap">{s.stdin || '∅'}</pre>
                      </div>
                      <div>
                        <span className="text-muted">{t('coding.expectedStdout')}</span>
                        <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap">{s.expectedStdout || '∅'}</pre>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <SamplePreview
              results={sampleResults}
              total={attempt.data.sampleTests.length}
              passed={samplePassed}
              error={runnerError}
            />
            <SubmissionResult isGrading={isGrading} submission={sub} />
          </div>

          {/* Cột phải: editor Monaco với chrome sticker + actions */}
          <div className="space-y-3">
            <div
              className="overflow-hidden"
              style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-divider)' }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: '#0f111a', borderBottom: '1px solid var(--color-divider)' }}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: 'var(--cx-coral)' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: 'var(--cx-amber)' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: 'var(--cx-teal)' }} />
                <span className="text-muted ml-2 font-mono text-xs">solution.py</span>
              </div>
              <Editor
                height="380px"
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

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={onRun} disabled={running} className="btn btn-secondary cx-press !rounded-full">
                <i className="ph ph-play" aria-hidden />
                {running ? t('coding.running') : t('coding.run')}
              </button>
              <button onClick={onSubmit} disabled={submit.isPending || isGrading} className="btn btn-primary cx-press">
                <i className="ph ph-check-circle" aria-hidden />
                {submit.isPending ? t('coding.submitting') : t('coding.submit')}
              </button>
            </div>
            <p className="text-muted text-xs">{t('coding.previewNote')}</p>
          </div>
        </div>
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
  if (!results) {
    // Trạng thái chờ — mascot huh
    return (
      <div className="card flex-row items-center gap-3" style={{ borderRadius: 'var(--radius-lg)' }}>
        <img src="/brand/mascot-huh.png" alt="" className="cx-bob h-[52px] w-[52px] shrink-0" />
        <p className="text-muted text-sm">{t('coding.idleHint')}</p>
      </div>
    );
  }
  const allPassed = passed === total && total > 0;
  return (
    <div
      className="card gap-2"
      style={{
        borderRadius: 'var(--radius-lg)',
        animation: 'cx-pop 0.3s ease',
        background: allPassed
          ? 'linear-gradient(120deg, color-mix(in srgb, var(--cx-teal) 18%, var(--color-surface)), var(--color-surface))'
          : undefined,
        border: allPassed ? '1px solid color-mix(in srgb, var(--cx-teal) 40%, transparent)' : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        {allPassed && <img src="/brand/mascot-hearts.png" alt="" className="cx-bob h-[40px] w-[40px] shrink-0" />}
        <p className="cx-display" style={{ fontSize: 15 }}>
          {t('coding.samplePreviewHeading')} · {t('coding.samplePassed', { passed, total })}
        </p>
      </div>
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
      style={{
        borderRadius: 'var(--radius-lg)',
        ...(passed
          ? {
              background: 'linear-gradient(120deg, color-mix(in srgb, var(--cx-teal) 22%, var(--color-surface)), var(--color-surface))',
              border: '1px solid color-mix(in srgb, var(--cx-teal) 40%, transparent)',
              animation: 'cx-pop 0.3s ease',
            }
          : {}),
      }}
    >
      <p className="cx-display" style={{ fontSize: 15 }}>{t('coding.yourResult')}</p>
      {isGrading && !submission ? (
        <p className="text-sm" style={{ color: 'var(--color-accent-300)' }}>{t('coding.grading')}</p>
      ) : submission ? (
        <>
          <div className="flex items-center gap-3 text-sm">
            {passed && <img src="/brand/mascot-hearts.png" alt="" className="cx-bob h-[44px] w-[44px] shrink-0" />}
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
