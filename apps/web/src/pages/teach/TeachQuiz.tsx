import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CHOICE_QUESTION_TYPES,
  type AuthorQuizQuestionDto,
  type QuizAuthorDetail,
  type QuizQuestionTypeValue,
  type UpsertQuestionOptionRequest,
} from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useCourse, useCourses } from '../../features/courses/hooks';
import {
  useCreateQuiz,
  useDeleteQuestion,
  useDeleteQuiz,
  useQuiz,
  useQuizzes,
  useUpdateQuiz,
  useUpsertQuestion,
} from '../../features/quiz/hooks';

const QUESTION_TYPES: QuizQuestionTypeValue[] = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_answer',
  'code_fill',
];

const isChoiceType = (t: QuizQuestionTypeValue): boolean =>
  (CHOICE_QUESTION_TYPES as readonly QuizQuestionTypeValue[]).includes(t);
const isSingleAnswer = (t: QuizQuestionTypeValue): boolean =>
  t === 'single_choice' || t === 'true_false';

export function TeachQuiz(): JSX.Element {
  const { t } = useTranslation();
  const courses = useCourses();
  const [courseId, setCourseId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeCourseId = courseId || courses.data?.items[0]?.id || '';

  return (
    <div className="nocturne-surface space-y-4 rounded-lg p-4">
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

      <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          {activeCourseId && (
            <CreateQuizForm courseId={activeCourseId} onCreated={(id) => setSelectedId(id)} />
          )}
          {!activeCourseId ? (
            <p className="text-muted text-sm">{t('assignments.selectCourse')}</p>
          ) : (
            <QuizList courseId={activeCourseId} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>

        <div>
          {selectedId ? (
            <QuizEditor
              quizId={selectedId}
              courseId={activeCourseId}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <EmptyHint text={t('quiz.selectHint')} mascot="mascot-huh.png" />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyHint({ text, mascot }: { text: string; mascot: string }): JSX.Element {
  return (
    <div className="card items-center gap-3 py-10 text-center">
      <img src={`/brand/${mascot}`} alt="" className="h-16 w-16" />
      <p className="text-muted text-sm">{text}</p>
    </div>
  );
}

function CreateQuizForm({
  courseId,
  onCreated,
}: {
  courseId: string;
  onCreated: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const course = useCourse(courseId);
  const create = useCreateQuiz();

  const [title, setTitle] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [passScore, setPassScore] = useState(0);
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [timeLimitMin, setTimeLimitMin] = useState(0);

  const lessons = (course.data?.sections ?? []).flatMap((s) =>
    (s.lessons ?? []).map((l) => ({ id: l.id, title: l.title })),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        courseId,
        title: title.trim(),
        lessonId: lessonId || undefined,
        passScore: Number(passScore),
        attemptsAllowed: Number(attemptsAllowed),
        timeLimitSec: timeLimitMin > 0 ? Number(timeLimitMin) * 60 : null,
      },
      {
        onSuccess: (q) => {
          setTitle('');
          setLessonId('');
          onCreated(q.id);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="card gap-3">
      <p className="card-title">{t('quiz.create')}</p>
      <div className="field">
        <label>{t('quiz.title')}</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('quiz.titlePlaceholder')}
          required
        />
      </div>
      <div className="field">
        <label>{t('quiz.lesson')}</label>
        <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          <option value="">{t('quiz.noLesson')}</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="field">
          <label>{t('quiz.passScore')}</label>
          <input
            className="input"
            type="number"
            min={0}
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>{t('quiz.attempts')}</label>
          <input
            className="input"
            type="number"
            min={1}
            value={attemptsAllowed}
            onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>{t('quiz.timeLimitMin')}</label>
          <input
            className="input"
            type="number"
            min={0}
            value={timeLimitMin}
            onChange={(e) => setTimeLimitMin(Number(e.target.value))}
          />
        </div>
      </div>
      <button type="submit" disabled={create.isPending} className="btn btn-primary btn-block">
        {t('quiz.add')}
      </button>
      {create.isError && <p className="text-xs text-red-400">{errMsg(create.error)}</p>}
    </form>
  );
}

function QuizList({
  courseId,
  selectedId,
  onSelect,
}: {
  courseId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const quizzes = useQuizzes(courseId);

  if (quizzes.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (quizzes.data && quizzes.data.items.length === 0) {
    return <EmptyHint text={t('quiz.empty')} mascot="mascot-default.png" />;
  }

  return (
    <div className="space-y-2">
      {quizzes.data?.items.map((q) => {
        const active = selectedId === q.id;
        return (
          <button
            key={q.id}
            onClick={() => onSelect(q.id)}
            className="card w-full gap-1 text-left"
            style={
              active
                ? {
                    background: 'var(--color-accent-900)',
                    boxShadow: 'inset 0 0 0 1px var(--color-accent-700)',
                  }
                : undefined
            }
          >
            <span
              className="card-title truncate"
              style={active ? { color: 'var(--color-accent-100)' } : undefined}
            >
              {q.title}
            </span>
            <span className="card-meta">
              {t('quiz.questionCount', { count: q.questionCount })} · {t('quiz.maxScore')} {q.maxScore}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function QuizEditor({
  quizId,
  courseId,
  onDeleted,
}: {
  quizId: string;
  courseId: string;
  onDeleted: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const quiz = useQuiz(quizId);
  const del = useDeleteQuiz(courseId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (quiz.isLoading || !quiz.data) {
    return <p className="text-muted text-sm">{t('common.loading')}</p>;
  }
  const q = quiz.data;

  return (
    <div className="space-y-4">
      <div className="card gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate">{q.title}</h2>
            <p className="card-meta mt-1 flex-wrap">
              <span>{t('quiz.questionCount', { count: q.questionCount })}</span>
              <span>· {t('quiz.maxScore')} {q.maxScore}</span>
              <span>· {t('quiz.passScore')} {q.passScore}</span>
              <span>· {t('quiz.attempts')} {q.attemptsAllowed}</span>
              {q.timeLimitSec ? <span>· {Math.round(q.timeLimitSec / 60)}′</span> : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn btn-secondary" onClick={() => setSettingsOpen(true)}>
              {t('quiz.settings')}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(t('quiz.confirmDelete'))) del.mutate(q.id, { onSuccess: onDeleted });
              }}
            >
              {t('quiz.delete')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {q.shuffleQuestions && <span className="tag tag-neutral">{t('quiz.shuffleQuestions')}</span>}
          {q.shuffleOptions && <span className="tag tag-neutral">{t('quiz.shuffleOptions')}</span>}
        </div>
      </div>

      {settingsOpen && (
        <QuizSettingsDialog quiz={q} onClose={() => setSettingsOpen(false)} />
      )}

      <QuestionsManager quiz={q} />
    </div>
  );
}

function QuizSettingsDialog({
  quiz,
  onClose,
}: {
  quiz: QuizAuthorDetail;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const update = useUpdateQuiz(quiz.id);
  const [title, setTitle] = useState(quiz.title);
  const [passScore, setPassScore] = useState(quiz.passScore);
  const [attemptsAllowed, setAttemptsAllowed] = useState(quiz.attemptsAllowed);
  const [timeLimitMin, setTimeLimitMin] = useState(quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : 0);
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz.shuffleQuestions);
  const [shuffleOptions, setShuffleOptions] = useState(quiz.shuffleOptions);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        title: title.trim(),
        passScore: Number(passScore),
        attemptsAllowed: Number(attemptsAllowed),
        timeLimitSec: timeLimitMin > 0 ? Number(timeLimitMin) * 60 : null,
        shuffleQuestions,
        shuffleOptions,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p className="dialog-title">{t('quiz.settings')}</p>
        <div className="field">
          <label>{t('quiz.title')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="field">
            <label>{t('quiz.passScore')}</label>
            <input
              className="input"
              type="number"
              min={0}
              value={passScore}
              onChange={(e) => setPassScore(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>{t('quiz.attempts')}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={attemptsAllowed}
              onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>{t('quiz.timeLimitMin')}</label>
            <input
              className="input"
              type="number"
              min={0}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <CheckboxRow
            label={t('quiz.shuffleQuestions')}
            checked={shuffleQuestions}
            onChange={setShuffleQuestions}
          />
          <CheckboxRow
            label={t('quiz.shuffleOptions')}
            checked={shuffleOptions}
            onChange={setShuffleOptions}
          />
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('quiz.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={update.isPending}>
            {t('quiz.save')}
          </button>
        </div>
        {update.isError && <p className="text-xs text-red-400">{errMsg(update.error)}</p>}
      </form>
    </div>
  );
}

function QuestionsManager({ quiz }: { quiz: QuizAuthorDetail }): JSX.Element {
  const { t } = useTranslation();
  const del = useDeleteQuestion(quiz.id);
  const [editing, setEditing] = useState<AuthorQuizQuestionDto | 'new' | null>(null);

  const nextOrder = quiz.questions.length;

  return (
    <div className="card gap-3">
      <div className="flex items-center justify-between">
        <h3>{t('quiz.questions')}</h3>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          {t('quiz.addQuestion')}
        </button>
      </div>

      {quiz.questions.length === 0 ? (
        <p className="text-muted text-sm">{t('quiz.noQuestions')}</p>
      ) : (
        <ol className="space-y-3">
          {quiz.questions.map((question, idx) => (
            <QuestionCard
              key={question.id}
              index={idx}
              question={question}
              onEdit={() => setEditing(question)}
              onDelete={() => {
                if (confirm(t('quiz.confirmDeleteQuestion'))) del.mutate(question.id);
              }}
            />
          ))}
        </ol>
      )}

      {editing && (
        <QuestionForm
          quizId={quiz.id}
          initial={editing === 'new' ? null : editing}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  onEdit,
  onDelete,
}: {
  index: number;
  question: AuthorQuizQuestionDto;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      className="rounded-md p-3"
      style={{ background: 'var(--color-neutral-900)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-pre-wrap text-sm">
            <span className="text-muted mr-1">{index + 1}.</span>
            {question.promptMd}
          </p>
          <div className="card-meta mt-1 flex-wrap">
            <span className="tag tag-outline">{t(`quiz.qtype_${question.type}`)}</span>
            <span>· {t('quiz.points', { points: question.points })}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost" onClick={onEdit}>
            {t('quiz.edit')}
          </button>
          <button className="btn btn-ghost btn-danger" onClick={onDelete}>
            {t('quiz.delete')}
          </button>
        </div>
      </div>

      {isChoiceType(question.type) ? (
        <ul className="mt-2 space-y-1">
          {question.options.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-xs">
              <span
                className={o.isCorrect ? 'tag tag-accent' : 'tag tag-neutral'}
                aria-hidden
              >
                {o.isCorrect ? '✓' : '·'}
              </span>
              <span className={o.isCorrect ? '' : 'text-muted'}>{o.textMd}</span>
            </li>
          ))}
        </ul>
      ) : question.correctAnswer ? (
        <p className="text-muted mt-2 text-xs">
          {t('quiz.correctAnswer')}: <span className="font-mono">{question.correctAnswer}</span>
        </p>
      ) : null}
    </li>
  );
}

interface EditableOption extends UpsertQuestionOptionRequest {
  _key: string;
}

let optKeySeq = 0;
const newOption = (init?: Partial<EditableOption>): EditableOption => ({
  _key: `opt-${optKeySeq++}`,
  textMd: '',
  isCorrect: false,
  ...init,
});

function QuestionForm({
  quizId,
  initial,
  nextOrder,
  onClose,
}: {
  quizId: string;
  initial: AuthorQuizQuestionDto | null;
  nextOrder: number;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const upsert = useUpsertQuestion(quizId);

  const [type, setType] = useState<QuizQuestionTypeValue>(initial?.type ?? 'single_choice');
  const [promptMd, setPromptMd] = useState(initial?.promptMd ?? '');
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [correctAnswer, setCorrectAnswer] = useState(initial?.correctAnswer ?? '');
  const [options, setOptions] = useState<EditableOption[]>(() => {
    if (initial && isChoiceType(initial.type)) {
      return initial.options.map((o) =>
        newOption({ id: o.id, textMd: o.textMd, isCorrect: o.isCorrect, order: o.order }),
      );
    }
    if (initial?.type === 'true_false') return [];
    return [newOption(), newOption()];
  });

  const choice = isChoiceType(type);
  const single = isSingleAnswer(type);

  const changeType = (next: QuizQuestionTypeValue) => {
    setType(next);
    if (next === 'true_false') {
      setOptions([
        newOption({ textMd: t('quiz.tfTrue'), isCorrect: true }),
        newOption({ textMd: t('quiz.tfFalse') }),
      ]);
    } else if (isChoiceType(next) && options.length === 0) {
      setOptions([newOption(), newOption()]);
    }
  };

  const setCorrect = (key: string, value: boolean) => {
    setOptions((prev) =>
      prev.map((o) => {
        if (single) return { ...o, isCorrect: o._key === key };
        return o._key === key ? { ...o, isCorrect: value } : o;
      }),
    );
  };

  const canSubmit = useMemo(() => {
    if (!promptMd.trim()) return false;
    if (choice) {
      const filled = options.filter((o) => o.textMd.trim());
      return filled.length >= 2 && filled.some((o) => o.isCorrect);
    }
    return correctAnswer.trim().length > 0;
  }, [promptMd, choice, options, correctAnswer]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    upsert.mutate(
      {
        id: initial?.id,
        type,
        promptMd: promptMd.trim(),
        points: Number(points),
        order: initial ? initial.order : nextOrder,
        correctAnswer: choice ? null : correctAnswer.trim(),
        options: choice
          ? options
              .filter((o) => o.textMd.trim())
              .map((o, i) => ({
                id: o.id,
                textMd: o.textMd.trim(),
                isCorrect: o.isCorrect,
                order: i,
              }))
          : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md p-3"
      style={{ background: 'var(--color-neutral-900)', boxShadow: 'inset 0 0 0 1px var(--color-divider)' }}
    >
      <p className="card-title">{initial ? t('quiz.editQuestion') : t('quiz.addQuestion')}</p>

      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
        <div className="field">
          <label>{t('quiz.qtype')}</label>
          <select
            className="input"
            value={type}
            onChange={(e) => changeType(e.target.value as QuizQuestionTypeValue)}
          >
            {QUESTION_TYPES.map((qt) => (
              <option key={qt} value={qt}>
                {t(`quiz.qtype_${qt}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('quiz.pointsLabel')}</label>
          <input
            className="input"
            type="number"
            min={0}
            step="0.5"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>{t('quiz.prompt')}</label>
        <textarea
          className="input"
          rows={2}
          value={promptMd}
          onChange={(e) => setPromptMd(e.target.value)}
          placeholder={t('quiz.promptPlaceholder')}
          required
        />
      </div>

      {choice ? (
        <div className="space-y-2">
          <p className="text-muted text-xs">
            {single ? t('quiz.markSingleHint') : t('quiz.markMultiHint')}
          </p>
          {options.map((o) => (
            <div key={o._key} className="flex items-center gap-2">
              <label className="checkbox" title={t('quiz.markCorrect')}>
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name={single ? 'correct' : undefined}
                  checked={o.isCorrect}
                  onChange={(e) => setCorrect(o._key, e.target.checked)}
                />
                <span className="box">{o.isCorrect ? '✓' : ''}</span>
              </label>
              <input
                className="input"
                value={o.textMd}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((x) => (x._key === o._key ? { ...x, textMd: e.target.value } : x)),
                  )
                }
                placeholder={t('quiz.optionPlaceholder')}
              />
              {type !== 'true_false' && options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-danger"
                  onClick={() => setOptions((prev) => prev.filter((x) => x._key !== o._key))}
                  aria-label={t('quiz.removeOption')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {type !== 'true_false' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOptions((prev) => [...prev, newOption()])}
            >
              {t('quiz.addOption')}
            </button>
          )}
        </div>
      ) : (
        <div className="field">
          <label>{t('quiz.correctAnswer')}</label>
          <textarea
            className="input font-mono"
            rows={2}
            value={correctAnswer ?? ''}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            placeholder={t('quiz.correctAnswerPlaceholder')}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={upsert.isPending || !canSubmit}>
          {t('quiz.save')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t('quiz.cancel')}
        </button>
      </div>
      {upsert.isError && <p className="text-xs text-red-400">{errMsg(upsert.error)}</p>}
    </form>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">{checked ? '✓' : ''}</span>
      <span className="text-sm">{label}</span>
    </label>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
