import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  QuizAttemptDto,
  QuizAnswerResultDto,
  QuizStudentDetail,
  QuizSummary,
  StudentQuizQuestionDto,
  SubmitQuizAnswerInput,
} from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useQuizAttempt, useQuizzesForClass, useSubmitQuizAttempt } from '../../features/quiz/hooks';

interface LocalAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
}

export function LearnQuiz({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const quizzes = useQuizzesForClass(classId);
  const [openId, setOpenId] = useState<string | null>(null);

  // Đổi lớp → đóng bài đang mở.
  useEffect(() => {
    setOpenId(null);
  }, [classId]);

  if (openId) {
    return (
      <QuizWorkspace
        key={openId}
        quizId={openId}
        classId={classId}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="nocturne-surface space-y-3 rounded-lg p-4">
      <h2>{t('quiz.heading')}</h2>
      {quizzes.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {quizzes.isError && <p className="text-sm text-red-400">{t('common.error')}</p>}
      {quizzes.data && quizzes.data.length === 0 && (
        <p className="text-muted text-sm">{t('quiz.noProblems')}</p>
      )}
      {quizzes.data && quizzes.data.length > 0 && (
        <ul className="space-y-2">
          {quizzes.data.map((q) => (
            <QuizRow key={q.id} quiz={q} onOpen={() => setOpenId(q.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function QuizRow({ quiz, onOpen }: { quiz: QuizSummary; onOpen: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <li className="card flex-row flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="card-title truncate">{quiz.title}</p>
        <p className="card-meta flex-wrap">
          <span>{t('quiz.questionCount', { count: quiz.questionCount })}</span>
          <span>· {t('quiz.maxScore')} {quiz.maxScore}</span>
          <span>· {t('quiz.passScore')} {quiz.passScore}</span>
          <span>· {t('quiz.attempts')} {quiz.attemptsAllowed}</span>
        </p>
      </div>
      <button className="btn btn-primary shrink-0" onClick={onOpen}>
        {t('quiz.open')}
      </button>
    </li>
  );
}

function QuizWorkspace({
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
    <div className="nocturne-surface space-y-4 rounded-lg p-4">
      <button className="btn btn-ghost" onClick={onBack}>
        {t('quiz.back')}
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
                <button type="submit" className="btn btn-primary" disabled={submit.isPending}>
                  {submit.isPending ? t('quiz.submitting') : t('quiz.submit')}
                </button>
                {exhausted && <span className="text-sm text-red-400">{t('quiz.attemptsExhausted')}</span>}
                {submit.isError && !exhausted && (
                  <span className="text-sm text-red-400">{t('common.error')}</span>
                )}
              </div>
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
      <h2>{detail.title}</h2>
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
    <div className="rounded-md p-3" style={{ background: 'var(--color-neutral-900)' }}>
      <p className="whitespace-pre-wrap text-sm">
        <span className="text-muted mr-1">{index + 1}.</span>
        {question.promptMd}
        <span className="text-muted ml-2 text-xs">({t('quiz.points', { points: question.points })})</span>
      </p>

      {question.options.length > 0 ? (
        <div className="mt-2 space-y-1.5">
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
          className="input mt-2 font-mono"
          rows={3}
          value={answer.textAnswer}
          onChange={(e) => onText(e.target.value)}
          placeholder={t('quiz.answerPlaceholder')}
        />
      ) : (
        <input
          className="input mt-2"
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

  return (
    <div className="space-y-4">
      <div
        className="card flex-row items-center gap-4"
        style={{
          background: passed ? 'var(--color-accent-900)' : 'var(--color-surface)',
          boxShadow: passed ? 'inset 0 0 0 1px var(--color-accent-700)' : undefined,
        }}
      >
        <img
          src={passed ? '/brand/mascot-hearts.png' : '/brand/mascot-grumpy.png'}
          alt=""
          className="h-16 w-16 shrink-0"
        />
        <div>
          <p className="card-title">
            {t('quiz.yourScore')}: {score} / {result.maxScore}
          </p>
          <span className={passed ? 'tag tag-accent' : 'tag tag-neutral'}>
            {passed ? t('quiz.passed') : t('quiz.failed')}
          </span>
        </div>
      </div>

      {/* Per-question đúng/sai — KHÔNG lộ đáp án đúng (invariant). */}
      <ol className="space-y-2">
        {detail.questions.map((q, idx) => {
          const ans = byQuestion.get(q.id);
          const answered = !!ans;
          const correct = ans?.isCorrect ?? false;
          return (
            <li
              key={q.id}
              className="rounded-md p-3"
              style={{ background: 'var(--color-neutral-900)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm">
                  <span className="text-muted mr-1">{idx + 1}.</span>
                  {q.promptMd}
                </p>
                <span
                  className={`tag shrink-0 ${correct ? 'tag-accent' : 'tag-neutral'}`}
                >
                  {!answered
                    ? t('quiz.unanswered')
                    : correct
                      ? t('quiz.answerCorrect')
                      : t('quiz.answerWrong')}
                </span>
              </div>
              <p className="card-meta mt-1">
                {t('quiz.points', { points: ans?.awardedPoints ?? 0 })} / {q.points}
              </p>
            </li>
          );
        })}
      </ol>

      <button className="btn btn-secondary" onClick={onRetake}>
        {t('quiz.retake')}
      </button>
    </div>
  );
}
