import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  QuizAttemptDto,
  QuizAnswerResultDto,
  QuizStudentDetail,
  StudentQuizQuestionDto,
  SubmitQuizAnswerInput,
} from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useQuizAttempt, useSubmitQuizAttempt } from '../../features/quiz/hooks';

interface LocalAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
}

/**
 * Không gian làm bài trắc nghiệm (mở từ hub Bài tập của LearnHome — openId pattern).
 * INVARIANT: chỉ hiện đúng/sai SAU KHI nộp, từ QuizAttemptDto.answers[] (không có option đúng
 * thực sự nếu HV chọn sai → không lộ đáp án chưa biết). Khi đang làm KHÔNG hiện bất kỳ đánh dấu nào.
 */
export function LearnQuizWorkspace({
  quizId,
  classId,
  onBack,
}: {
  quizId: string;
  classId: string;
  onBack: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const attempt = useQuizAttempt(quizId, classId);
  const submit = useSubmitQuizAttempt(quizId);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [result, setResult] = useState<QuizAttemptDto | null>(null);

  const getAnswer = (qId: string): LocalAnswer =>
    answers[qId] ?? { selectedOptionIds: [], textAnswer: '' };

  const setSingle = (qId: string, optId: string) =>
    setAnswers((p) => ({ ...p, [qId]: { selectedOptionIds: [optId], textAnswer: '' } }));

  const toggleMulti = (qId: string, optId: string) =>
    setAnswers((p) => {
      const cur = p[qId]?.selectedOptionIds ?? [];
      const next = cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId];
      return { ...p, [qId]: { selectedOptionIds: next, textAnswer: '' } };
    });

  const setText = (qId: string, textAnswer: string) =>
    setAnswers((p) => ({ ...p, [qId]: { selectedOptionIds: [], textAnswer } }));

  const buildPayload = (questions: StudentQuizQuestionDto[]): SubmitQuizAnswerInput[] =>
    questions
      .map((q): SubmitQuizAnswerInput | null => {
        const a = getAnswer(q.id);
        if (q.options.length > 0) {
          return a.selectedOptionIds.length > 0
            ? { questionId: q.id, selectedOptionIds: a.selectedOptionIds }
            : null;
        }
        return a.textAnswer.trim() ? { questionId: q.id, textAnswer: a.textAnswer.trim() } : null;
      })
      .filter((x): x is SubmitQuizAnswerInput => x !== null);

  const onSubmit = (questions: StudentQuizQuestionDto[]) => {
    submit.mutate(
      { classId, answers: buildPayload(questions) },
      { onSuccess: (dto) => setResult(dto) },
    );
  };

  const retake = () => {
    setResult(null);
    setAnswers({});
    submit.reset();
  };

  const exhausted = submit.error instanceof ApiError && submit.error.status === 403;

  return (
    <div className="mx-auto max-w-[640px] space-y-5">
      <button className="btn btn-ghost cx-press self-start" onClick={onBack}>
        <i className="ph ph-arrow-left" aria-hidden /> {t('quiz.backList')}
      </button>

      {attempt.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {attempt.isError && <p className="text-sm text-red-400">{t('common.error')}</p>}

      {attempt.data && (
        <>
          <QuizHeader detail={attempt.data} />

          {result ? (
            <QuizResult detail={attempt.data} result={result} onRetake={retake} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(attempt.data!.questions);
              }}
              className="space-y-4"
            >
              {attempt.data.questions.map((q, idx) => (
                <QuestionInput
                  key={q.id}
                  index={idx}
                  question={q}
                  answer={getAnswer(q.id)}
                  onSingle={(optId) => setSingle(q.id, optId)}
                  onToggle={(optId) => toggleMulti(q.id, optId)}
                  onText={(txt) => setText(q.id, txt)}
                />
              ))}

              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary btn-block cx-press" disabled={submit.isPending}>
                  <i className="ph ph-paper-plane-tilt" aria-hidden />
                  {submit.isPending ? t('quiz.submitting') : t('quiz.submit')}
                </button>
              </div>
              {exhausted && <span className="text-sm text-red-400">{t('quiz.attemptsExhausted')}</span>}
              {submit.isError && !exhausted && (
                <span className="text-sm text-red-400">{t('common.error')}</span>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}

function QuizHeader({ detail }: { detail: QuizStudentDetail }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="cx-display text-2xl">{detail.title}</h1>
      <p className="card-meta mt-1 flex-wrap">
        <span>{t('quiz.questionCount', { count: detail.questionCount })}</span>
        <span>· {t('quiz.maxScore')} {detail.maxScore}</span>
        <span>· {t('quiz.passScore')} {detail.passScore}</span>
        {detail.timeLimitSec ? <span>· {Math.round(detail.timeLimitSec / 60)}′</span> : null}
      </p>
    </div>
  );
}

function QuestionInput({
  index,
  question,
  answer,
  onSingle,
  onToggle,
  onText,
}: {
  index: number;
  question: StudentQuizQuestionDto;
  answer: LocalAnswer;
  onSingle: (optId: string) => void;
  onToggle: (optId: string) => void;
  onText: (txt: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const multi = question.type === 'multiple_choice';

  return (
    <div className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
      <p className="cx-display whitespace-pre-wrap" style={{ fontSize: 16 }}>
        <span className="text-muted mr-1">{index + 1}.</span>
        {question.promptMd}
        <span className="text-muted ml-2 text-xs">({t('quiz.points', { points: question.points })})</span>
      </p>

      {question.options.length > 0 ? (
        <div className="mt-1 space-y-1.5">
          {question.options.map((o) =>
            multi ? (
              <label key={o.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={answer.selectedOptionIds.includes(o.id)}
                  onChange={() => onToggle(o.id)}
                />
                <span className="box">{answer.selectedOptionIds.includes(o.id) ? '✓' : ''}</span>
                <span className="text-sm">{o.textMd}</span>
              </label>
            ) : (
              <label key={o.id} className="radio">
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={answer.selectedOptionIds[0] === o.id}
                  onChange={() => onSingle(o.id)}
                />
                <span className="dot" />
                <span className="text-sm">{o.textMd}</span>
              </label>
            ),
          )}
        </div>
      ) : question.type === 'code_fill' ? (
        <textarea
          className="input mt-1 font-mono"
          rows={3}
          value={answer.textAnswer}
          onChange={(e) => onText(e.target.value)}
          placeholder={t('quiz.answerPlaceholder')}
        />
      ) : (
        <input
          className="input mt-1"
          value={answer.textAnswer}
          onChange={(e) => onText(e.target.value)}
          placeholder={t('quiz.answerPlaceholder')}
        />
      )}
    </div>
  );
}

function QuizResult({
  detail,
  result,
  onRetake,
}: {
  detail: QuizStudentDetail;
  result: QuizAttemptDto;
  onRetake: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const score = result.score ?? 0;
  const passed = score >= detail.passScore;
  const byQuestion = useMemo(() => {
    const m = new Map<string, QuizAnswerResultDto>();
    (result.answers ?? []).forEach((a) => m.set(a.questionId, a));
    return m;
  }, [result.answers]);
  const correctCount = (result.answers ?? []).filter((a) => a.isCorrect).length;

  return (
    <div className="space-y-4">
      <div
        className="card flex-row items-center gap-4"
        style={{
          animation: 'cx-pop 0.3s ease',
          borderRadius: 'var(--cx-radius)',
          background: passed
            ? 'linear-gradient(120deg, color-mix(in srgb, var(--cx-teal) 22%, var(--color-surface)), var(--color-surface))'
            : 'var(--color-surface)',
          border: passed ? '1px solid color-mix(in srgb, var(--cx-teal) 40%, transparent)' : '1px solid var(--color-divider)',
          padding: 'var(--space-6)',
        }}
      >
        <img
          src={passed ? '/brand/mascot-hearts.png' : '/brand/mascot-grumpy.png'}
          alt=""
          className="cx-bob h-[58px] w-[58px] shrink-0"
        />
        <div className="min-w-0">
          <p className="cx-display" style={{ fontSize: 18 }}>
            {t('quiz.resultSummary', { correct: correctCount, total: detail.questionCount, score })}
          </p>
          <span className={passed ? 'tag tag-accent' : 'tag tag-neutral'} style={{ marginTop: 4, display: 'inline-flex' }}>
            {passed ? t('quiz.passed') : t('quiz.failed')}
          </span>
        </div>
      </div>

      {/* Per-question: đánh dấu pick của HV (đúng→check accent, sai→x neutral). KHÔNG lộ đáp án chưa biết. */}
      <ol className="space-y-2">
        {detail.questions.map((q, idx) => {
          const ans = byQuestion.get(q.id);
          const answered = !!ans;
          const correct = ans?.isCorrect ?? false;
          const picks = new Set(ans?.selectedOptionIds ?? []);
          return (
            <li key={q.id} className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm">
                  <span className="text-muted mr-1">{idx + 1}.</span>
                  {q.promptMd}
                </p>
                <span className={`tag shrink-0 ${correct ? 'tag-accent' : 'tag-neutral'}`}>
                  {!answered ? t('quiz.unanswered') : correct ? t('quiz.answerCorrect') : t('quiz.answerWrong')}
                </span>
              </div>

              {q.options.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {q.options.map((o) => {
                    const picked = picks.has(o.id);
                    return (
                      <li key={o.id} className="flex items-center gap-2 text-sm">
                        {picked ? (
                          correct ? (
                            <i className="ph-fill ph-check-circle" style={{ color: 'var(--color-accent-300)' }} aria-hidden />
                          ) : (
                            <i className="ph-fill ph-x-circle" style={{ color: 'var(--color-neutral-500)' }} aria-hidden />
                          )
                        ) : (
                          <i className="ph ph-circle" style={{ color: 'var(--color-neutral-700)' }} aria-hidden />
                        )}
                        <span className={picked ? '' : 'text-muted'}>{o.textMd}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {q.options.length === 0 && ans?.textAnswer && (
                <p className="card-meta mt-1">
                  <i className="ph ph-text-aa" aria-hidden /> {ans.textAnswer}
                </p>
              )}

              <p className="card-meta mt-1">
                {t('quiz.points', { points: ans?.awardedPoints ?? 0 })} / {q.points}
              </p>
            </li>
          );
        })}
      </ol>

      <button className="btn btn-secondary cx-press" onClick={onRetake}>
        <i className="ph ph-arrow-counter-clockwise" aria-hidden /> {t('quiz.retake')}
      </button>
    </div>
  );
}
