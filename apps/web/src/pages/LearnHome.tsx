import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodingProblemSummary, MyLessonDto, QuizSummary } from '@lms/contracts';
import { useMe } from '../features/auth/hooks';
import { useMyClasses, useMyLessons, useUpdateProgress } from '../features/classes/hooks';
import { useQuizzesForClass } from '../features/quiz/hooks';
import { useCodingProblemsForClass } from '../features/coding/hooks';
import { LearnQuizWorkspace } from './learn/LearnQuiz';
import { LearnCodingWorkspace } from './learn/LearnCoding';

/* ── Lesson type → icon + category color ─────────────────────────────────── */
const LESSON_META: Record<string, { icon: string; color: string }> = {
  video: { icon: 'ph-video-camera', color: 'var(--cx-coral)' },
  article: { icon: 'ph-book-open', color: 'var(--cx-blue)' },
  interactive: { icon: 'ph-cursor-click', color: 'var(--cx-teal)' },
  coding: { icon: 'ph-code', color: 'var(--cx-teal)' },
  quiz: { icon: 'ph-check-square-offset', color: 'var(--cx-coral)' },
  assignment: { icon: 'ph-target', color: 'var(--cx-amber)' },
};
const lessonMeta = (type: string) => LESSON_META[type] ?? { icon: 'ph-book-bookmark', color: 'var(--cx-purple)' };

/* ── Merged exercise model (quiz + coding) ───────────────────────────────── */
type Exercise =
  | { kind: 'quiz'; id: string; title: string; lessonId?: string | null; questionCount: number; maxScore: number }
  | { kind: 'coding'; id: string; title: string; lessonId?: string | null; difficulty: string; maxScore: number };

type LearnView = 'list' | 'lesson' | 'quiz' | 'coding';

/** Ô icon bo tròn với nền tint category. */
function IconTile({ icon, color, size = 46 }: { icon: string; color: string; size?: number }): JSX.Element {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 22%, transparent)`,
        color,
        fontSize: size * 0.5,
      }}
    >
      <i className={`ph-fill ${icon}`} aria-hidden />
    </span>
  );
}

export function LearnHome(): JSX.Element {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const myClasses = useMyClasses();
  const [classId, setClassId] = useState<string | null>(null);

  const [view, setView] = useState<LearnView>('list');
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [openQuizId, setOpenQuizId] = useState<string | null>(null);
  const [openProblemId, setOpenProblemId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const lessons = useMyLessons(classId);
  const quizzes = useQuizzesForClass(classId);
  const coding = useCodingProblemsForClass(classId);
  const update = useUpdateProgress(classId ?? '');

  useEffect(() => {
    if (!classId && myClasses.data && myClasses.data.length > 0) {
      setClassId(myClasses.data[0].id);
    }
  }, [classId, myClasses.data]);

  // Đổi lớp → về danh sách, đóng mọi thứ đang mở.
  const backToList = () => {
    setView('list');
    setOpenLessonId(null);
    setOpenQuizId(null);
    setOpenProblemId(null);
  };
  useEffect(() => { backToList(); }, [classId]);

  const greetName = user?.fullName || user?.email || '';

  const exercises: Exercise[] = useMemo(() => {
    const q: Exercise[] = (quizzes.data ?? []).map((x: QuizSummary) => ({
      kind: 'quiz', id: x.id, title: x.title, lessonId: x.lessonId, questionCount: x.questionCount, maxScore: x.maxScore,
    }));
    const c: Exercise[] = (coding.data ?? []).map((x: CodingProblemSummary) => ({
      kind: 'coding', id: x.id, title: x.title, lessonId: x.lessonId, difficulty: x.difficulty, maxScore: x.maxScore,
    }));
    return [...q, ...c];
  }, [quizzes.data, coding.data]);

  const lessonById = useMemo(() => {
    const m = new Map<string, MyLessonDto>();
    (lessons.data ?? []).forEach((l) => m.set(l.lessonId, l));
    return m;
  }, [lessons.data]);

  const openLesson = (lessonId: string) => { setOpenLessonId(lessonId); setView('lesson'); };
  const openQuiz = (id: string) => { setOpenQuizId(id); setView('quiz'); };
  const openCoding = (id: string) => { setOpenProblemId(id); setView('coding'); };

  const onComplete = (lessonId: string) => {
    update.mutate(
      { lessonId, status: 'completed' },
      { onSuccess: () => { backToList(); setShowCelebration(true); } },
    );
  };

  // ── Detail views (openId pattern, không route mới) ──
  if (view === 'quiz' && openQuizId && classId) {
    return <section><LearnQuizWorkspace quizId={openQuizId} classId={classId} onBack={backToList} /></section>;
  }
  if (view === 'coding' && openProblemId && classId) {
    return <section><LearnCodingWorkspace problemId={openProblemId} classId={classId} onBack={backToList} /></section>;
  }
  if (view === 'lesson' && openLessonId) {
    const lesson = lessonById.get(openLessonId);
    if (lesson) {
      return (
        <LessonDetail
          lesson={lesson}
          exercises={exercises.filter((e) => e.lessonId === openLessonId)}
          onBack={backToList}
          onComplete={() => onComplete(openLessonId)}
          completing={update.isPending}
          onOpenQuiz={openQuiz}
          onOpenCoding={openCoding}
        />
      );
    }
  }

  return (
    <section className="space-y-8">
      {greetName && <GreetingHero name={greetName} />}

      {myClasses.data && myClasses.data.length > 1 && (
        <div className="seg flex-wrap">
          {myClasses.data.map((c) => {
            const active = classId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setClassId(c.id)}
                className="seg-opt"
                style={active ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)' } : undefined}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {myClasses.isLoading && <p className="text-muted">{t('common.loading')}</p>}
      {myClasses.data?.length === 0 && <p className="text-muted">{t('learn.noClasses')}</p>}

      {showCelebration && <CelebrationBanner onDismiss={() => setShowCelebration(false)} />}

      {classId && (
        <>
          <ContinueCard lessons={lessons.data ?? []} onOpen={openLesson} />
          <LessonsByChapter lessons={lessons.data ?? []} loading={lessons.isLoading} onOpen={openLesson} />
          <ExercisesHub exercises={exercises} lessonById={lessonById} onOpenQuiz={openQuiz} onOpenCoding={openCoding} />
        </>
      )}
    </section>
  );
}

/* ═══════════════ Greeting hero (stats + level ring — MOCK gamification) ═════ */
function GreetingHero({ name }: { name: string }): JSX.Element {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'learn.greetingMorning' : hour < 18 ? 'learn.greetingAfternoon' : 'learn.greetingEvening';

  // MOCK: streak / XP / badges / level chưa có API gamification — giá trị placeholder tĩnh.
  const MOCK = { streak: 5, xp: '1.240', badges: 8, level: 4, ringTurn: 0.78 };

  const stats = [
    { icon: 'ph-fire', color: 'var(--cx-amber)', value: t('learn.statStreakValue', { count: MOCK.streak }), label: t('learn.statStreak') },
    { icon: 'ph-star', color: 'var(--cx-teal)', value: MOCK.xp, label: t('learn.statXp') },
    { icon: 'ph-medal', color: 'var(--cx-coral)', value: String(MOCK.badges), label: t('learn.statBadges') },
  ];

  return (
    <div
      className="cx-dots relative overflow-hidden"
      style={{
        borderRadius: 'var(--cx-radius)',
        background: 'linear-gradient(140deg, var(--color-section), var(--color-section-glow))',
        padding: 'var(--space-8)',
      }}
    >
      <span className="cx-blob" style={{ width: 300, height: 300, top: -80, left: -40, background: 'var(--cx-purple)', opacity: 0.4 }} aria-hidden />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 flex-1" style={{ minWidth: 280 }}>
          <p className="text-[11px] uppercase tracking-[0.12em]" style={{ opacity: 0.85 }}>{t(greetKey)}</p>
          <h1 className="cx-display my-1" style={{ fontSize: 38 }}>{t('learn.heroTitle', { name })}</h1>
          <p style={{ opacity: 0.8 }}>{t('learn.heroMotivation')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="cx-lift flex items-center gap-2.5"
                style={{
                  background: 'color-mix(in srgb, #fff 8%, transparent)',
                  border: '1px solid color-mix(in srgb, #fff 14%, transparent)',
                  borderRadius: 16,
                  padding: '10px 16px',
                }}
              >
                <i className={`ph-fill ${s.icon}`} style={{ color: s.color, fontSize: 22 }} aria-hidden />
                <div>
                  <p className="cx-display" style={{ margin: 0, fontSize: 18, lineHeight: 1.1 }}>{s.value}</p>
                  <p className="text-[11px]" style={{ margin: 0, opacity: 0.7 }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Level ring — mascot cần chỗ nên wrapper có margin phải (gotcha clipping) */}
        <div className="relative shrink-0" style={{ marginRight: 28 }}>
          <div
            className="grid place-items-center rounded-full"
            style={{
              width: 132, height: 132,
              background: `conic-gradient(var(--cx-teal) 0turn ${MOCK.ringTurn}turn, color-mix(in srgb, #fff 12%, transparent) ${MOCK.ringTurn}turn 1turn)`,
            }}
          >
            <div className="grid place-items-center rounded-full" style={{ width: 104, height: 104, background: 'var(--color-section)' }}>
              <span className="cx-display" style={{ fontSize: 30, lineHeight: 1 }}>{MOCK.level}</span>
              <span className="text-[11px]" style={{ opacity: 0.7 }}>{t('learn.level')}</span>
            </div>
          </div>
          <img
            src="/brand/mascot-love.png"
            alt=""
            aria-hidden
            className="cx-bob absolute"
            style={{ width: 88, right: -26, bottom: -10 }}
          />
        </div>
      </div>
    </div>
  );
}

function CelebrationBanner({ onDismiss }: { onDismiss: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-4"
      style={{
        animation: 'cx-pop 0.3s ease',
        borderRadius: 'var(--cx-radius)',
        background: 'linear-gradient(120deg, color-mix(in srgb, var(--cx-teal) 22%, var(--color-surface)), var(--color-surface))',
        border: '1px solid color-mix(in srgb, var(--cx-teal) 40%, transparent)',
        padding: 'var(--space-4) var(--space-6)',
      }}
    >
      <img src="/brand/mascot-hearts.png" alt="" className="cx-bob h-16 w-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="cx-display" style={{ fontSize: 17 }}>{t('learn.celebrationTitle')}</p>
        <p className="text-muted text-sm">{t('learn.celebrationXp')}</p>
      </div>
      <button className="btn btn-icon btn-secondary !rounded-full cx-press" onClick={onDismiss} aria-label={t('learn.dismiss')}>
        <i className="ph ph-x" aria-hidden />
      </button>
    </div>
  );
}

/* ═══════════════ Continue card ═════════════════════════════════════════════ */
function ContinueCard({ lessons, onOpen }: { lessons: MyLessonDto[]; onOpen: (id: string) => void }): JSX.Element | null {
  const { t } = useTranslation();
  if (lessons.length === 0) return null;
  const target = lessons.find((l) => l.progressStatus === 'in_progress') ?? lessons.find((l) => l.progressStatus === 'not_started');
  if (!target) return null;
  const done = lessons.filter((l) => l.progressStatus === 'completed').length;
  const pct = Math.round((done / lessons.length) * 100);

  return (
    <div
      className="cx-lift relative flex flex-wrap items-center gap-4 overflow-hidden"
      style={{ borderRadius: 'var(--cx-radius)', background: 'var(--color-surface)', padding: 'var(--space-6)' }}
    >
      <span className="cx-blob" style={{ width: 180, height: 180, top: -60, right: -40, background: 'var(--cx-purple)', opacity: 0.25 }} aria-hidden />
      <span
        className="relative z-10 flex shrink-0 items-center justify-center rounded-2xl"
        style={{ width: 64, height: 64, background: 'linear-gradient(150deg, var(--cx-purple), color-mix(in srgb, var(--cx-purple) 40%, var(--color-bg)))', color: '#fff', fontSize: 30 }}
      >
        <i className="ph-fill ph-cursor-click" aria-hidden />
      </span>
      <div className="relative z-10 min-w-0 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-accent-300)' }}>{t('learn.continueKicker')}</p>
          <p className="cx-display truncate" style={{ fontSize: 20 }}>{target.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-neutral-800)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--cx-teal), var(--cx-purple))' }} />
          </div>
          <span className="text-muted shrink-0 text-xs">{pct}%</span>
        </div>
      </div>
      <button className="btn btn-primary cx-press relative z-10 shrink-0" onClick={() => onOpen(target.lessonId)}>
        {t('learn.continueCta')} <i className="ph ph-arrow-right" aria-hidden />
      </button>
    </div>
  );
}

/* ═══════════════ Lessons grouped by chapter ════════════════════════════════ */
const CHAPTER_LIMIT = 4;

function LessonsByChapter({
  lessons, loading, onOpen,
}: { lessons: MyLessonDto[]; loading: boolean; onOpen: (id: string) => void }): JSX.Element {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const chapters = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MyLessonDto[]>();
    lessons.forEach((l) => {
      const key = l.sectionTitle || t('learn.chapterOther');
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(l);
    });
    return order.map((title) => ({ title, items: map.get(title)! }));
  }, [lessons, t]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <IconTile icon="ph-book-open" color="var(--cx-blue)" size={40} />
        <h2 className="cx-display text-xl">{t('learn.lessonsHeading')}</h2>
      </div>

      {loading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {!loading && lessons.length === 0 && (
        <div className="text-muted rounded-2xl border border-dashed px-4 py-10 text-center text-sm" style={{ borderColor: 'var(--color-divider)' }}>
          <img src="/brand/mascot-default.png" alt="" className="mx-auto mb-3 h-20 w-20 opacity-80" />
          {t('learn.noLessons')}
        </div>
      )}

      {chapters.map((ch) => {
        const isCollapsed = collapsed.has(ch.title);
        const isExpanded = expanded.has(ch.title);
        const done = ch.items.filter((l) => l.progressStatus === 'completed').length;
        const shown = isExpanded ? ch.items : ch.items.slice(0, CHAPTER_LIMIT);
        const overflow = ch.items.length - CHAPTER_LIMIT;
        return (
          <div key={ch.title} className="space-y-3">
            <button
              className="cx-press flex w-full items-center gap-3 text-left"
              onClick={() => toggle(collapsed, setCollapsed, ch.title)}
            >
              <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-base`} style={{ color: 'var(--color-accent)' }} aria-hidden />
              <span className="text-[13px] font-semibold uppercase tracking-[0.06em]">{ch.title}</span>
              <span className="tag tag-neutral shrink-0">{t('learn.chapterProgress', { done, total: ch.items.length })}</span>
              <span className="hr m-0 flex-1" />
            </button>

            {!isCollapsed && (
              <>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                  {shown.map((l) => <LessonCard key={l.lessonId} lesson={l} onOpen={() => onOpen(l.lessonId)} />)}
                </div>
                {overflow > 0 && (
                  <button className="btn btn-ghost cx-press" onClick={() => toggle(expanded, setExpanded, ch.title)}>
                    {isExpanded ? t('learn.showLess') : t('learn.showMore', { count: overflow })}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function statusTag(status: string): { cls: string; key: string } {
  if (status === 'completed') return { cls: 'tag-accent', key: 'progress.completed' };
  if (status === 'in_progress') return { cls: 'tag-outline', key: 'progress.in_progress' };
  return { cls: 'tag-neutral', key: 'progress.not_started' };
}

function LessonCard({ lesson, onOpen }: { lesson: MyLessonDto; onOpen: () => void }): JSX.Element {
  const { t } = useTranslation();
  const meta = lessonMeta(lesson.type);
  const st = statusTag(lesson.progressStatus);
  const actionKey =
    lesson.progressStatus === 'completed' ? 'learn.lessonReview'
      : lesson.progressStatus === 'in_progress' ? 'learn.lessonContinue' : 'learn.lessonStart';
  return (
    <div
      className="card cx-tile"
      style={{ borderRadius: 'var(--cx-radius)', borderTop: `3px solid color-mix(in srgb, ${meta.color} 30%, transparent)`, boxShadow: 'var(--shadow-sm)', gap: 'var(--space-3)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <IconTile icon={meta.icon} color={meta.color} />
        <span className={`tag ${st.cls}`}>{t(st.key)}</span>
      </div>
      <p className="card-title cx-display" style={{ width: '100%' }}>{lesson.title}</p>
      <p className="card-meta">
        <i className={`ph ${meta.icon}`} aria-hidden /> {t(`lessonType.${lesson.type}`, { defaultValue: lesson.type })}
      </p>
      <button className="btn btn-secondary btn-block cx-press" style={{ marginTop: 'auto' }} onClick={onOpen}>
        {t(actionKey)}
      </button>
    </div>
  );
}

/* ═══════════════ Exercises hub (quiz + coding, filter) ═════════════════════ */
function ExercisesHub({
  exercises, lessonById, onOpenQuiz, onOpenCoding,
}: {
  exercises: Exercise[];
  lessonById: Map<string, MyLessonDto>;
  onOpenQuiz: (id: string) => void;
  onOpenCoding: (id: string) => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'quiz' | 'coding'>('all');
  if (exercises.length === 0) return null;
  const filtered = exercises.filter((e) => filter === 'all' || e.kind === filter);

  const filters: Array<{ key: 'all' | 'quiz' | 'coding'; label: string }> = [
    { key: 'all', label: t('learn.filterAll') },
    { key: 'quiz', label: t('learn.filterQuiz') },
    { key: 'coding', label: t('learn.filterCoding') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile icon="ph-target" color="var(--cx-amber)" size={40} />
          <h2 className="cx-display text-xl">{t('learn.exercisesHeading')}</h2>
        </div>
        <div className="seg shrink-0">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="seg-opt"
              style={filter === f.key ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)' } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {filtered.map((e) => (
          <ExerciseCard
            key={`${e.kind}-${e.id}`}
            exercise={e}
            lesson={e.lessonId ? lessonById.get(e.lessonId) : undefined}
            onOpen={() => (e.kind === 'quiz' ? onOpenQuiz(e.id) : onOpenCoding(e.id))}
          />
        ))}
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise, lesson, onOpen,
}: { exercise: Exercise; lesson?: MyLessonDto; onOpen: () => void }): JSX.Element {
  const { t } = useTranslation();
  const isQuiz = exercise.kind === 'quiz';
  const color = isQuiz ? 'var(--cx-coral)' : 'var(--cx-teal)';
  const icon = isQuiz ? 'ph-check-square-offset' : 'ph-code';
  const kindLabel = isQuiz ? t('learn.exKindQuiz') : t('learn.exKindCoding');
  const lessonLabel = lesson
    ? t('learn.exLessonLabel', { chapter: lesson.sectionTitle, lesson: lesson.title })
    : t('learn.exGeneral');
  const detailMeta = isQuiz
    ? t('learn.exMetaQuiz', { count: exercise.questionCount, score: exercise.maxScore })
    : t('learn.exMetaCoding', { difficulty: t(`coding.diff_${exercise.difficulty}`, { defaultValue: exercise.difficulty }), score: exercise.maxScore });

  return (
    <div
      className="card cx-lift flex-row items-start"
      style={{ borderRadius: 18, borderTop: `3px solid color-mix(in srgb, ${color} 30%, transparent)`, boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', gap: 'var(--space-4)' }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-2xl"
        style={{ width: 44, height: 44, background: `color-mix(in srgb, ${color} 22%, transparent)`, color, fontSize: 22 }}
      >
        <i className={`ph-fill ${icon}`} aria-hidden />
      </span>
      <div className="min-w-0 flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag tag-outline">{kindLabel}</span>
        </div>
        <p className="card-title cx-display" style={{ width: '100%' }}>{exercise.title}</p>
        <p className="card-meta"><i className="ph ph-book-bookmark" aria-hidden /> {lessonLabel}</p>
        <p className="card-meta"><i className="ph ph-list-checks" aria-hidden /> {detailMeta}</p>
      </div>
      <button className="btn btn-icon btn-secondary !rounded-full cx-press shrink-0" onClick={onOpen} aria-label={t('learn.open')}>
        <i className="ph ph-arrow-right" aria-hidden />
      </button>
    </div>
  );
}

/* ═══════════════ Lesson detail view ════════════════════════════════════════ */
function LessonDetail({
  lesson, exercises, onBack, onComplete, completing, onOpenQuiz, onOpenCoding,
}: {
  lesson: MyLessonDto;
  exercises: Exercise[];
  onBack: () => void;
  onComplete: () => void;
  completing: boolean;
  onOpenQuiz: (id: string) => void;
  onOpenCoding: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const isCompleted = lesson.progressStatus === 'completed';

  return (
    <section className="mx-auto max-w-[760px] space-y-5">
      <button className="btn btn-ghost cx-press self-start" onClick={onBack}>
        <i className="ph ph-arrow-left" aria-hidden /> {t('learn.backList')}
      </button>

      <div>
        <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-accent-300)' }}>{lesson.sectionTitle}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="cx-display text-3xl">{lesson.title}</h1>
          <span className="tag tag-outline">{t(`lessonType.${lesson.type}`, { defaultValue: lesson.type })}</span>
        </div>
      </div>

      {/* Media theo loại bài */}
      {lesson.type === 'video' && (
        <div
          className="relative grid place-items-center overflow-hidden"
          style={{ borderRadius: 'var(--cx-radius)', aspectRatio: '16 / 9', background: 'linear-gradient(155deg, var(--color-neutral-900), var(--color-section))', border: '1px solid var(--color-divider)' }}
        >
          <button className="btn btn-icon cx-press" style={{ width: 60, height: 60, borderRadius: '50%', background: 'color-mix(in srgb, #fff 12%, transparent)' }} aria-label={t('learn.play')}>
            <i className="ph-fill ph-play text-2xl" aria-hidden />
          </button>
        </div>
      )}
      {lesson.type === 'interactive' && (
        <div
          className="card items-center text-center"
          style={{ borderRadius: 'var(--cx-radius)', background: 'linear-gradient(150deg, color-mix(in srgb, var(--cx-teal) 14%, var(--color-neutral-900)), var(--color-neutral-900))', padding: 'var(--space-8)' }}
        >
          <i className="ph-fill ph-cursor-click text-3xl" style={{ color: 'var(--cx-teal)' }} aria-hidden />
          <p className="text-muted mt-2 text-sm" style={{ maxWidth: 420 }}>{t('learn.interactiveHint')}</p>
        </div>
      )}

      {/* Nội dung bài học — API my-lessons chưa trả body → placeholder (đánh dấu rõ) */}
      <div className="card" style={{ borderRadius: 'var(--cx-radius)' }}>
        <p className="card-title cx-display" style={{ fontSize: 15 }}>{t('learn.lessonContent')}</p>
        <p className="text-muted text-sm">{t('learn.lessonBodyPlaceholder')}</p>
      </div>

      {/* Bài tập của bài học này */}
      {exercises.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <IconTile icon="ph-target" color="var(--cx-amber)" size={36} />
            <p className="cx-display" style={{ fontSize: 16 }}>{t('learn.lessonExercises')}</p>
          </div>
          <ul className="space-y-2">
            {exercises.map((e) => {
              const isQuiz = e.kind === 'quiz';
              return (
                <li key={`${e.kind}-${e.id}`} className="card cx-lift flex-row flex-wrap items-center justify-between gap-3" style={{ borderRadius: 16 }}>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="tag tag-outline">{isQuiz ? t('learn.exKindQuiz') : t('learn.exKindCoding')}</span>
                    </div>
                    <p className="card-title truncate" style={{ fontSize: 15 }}>{e.title}</p>
                    <p className="card-meta">
                      {isQuiz
                        ? t('learn.exMetaQuiz', { count: e.questionCount, score: e.maxScore })
                        : t('learn.exMetaCoding', { difficulty: t(`coding.diff_${e.difficulty}`, { defaultValue: e.difficulty }), score: e.maxScore })}
                    </p>
                  </div>
                  <button className="btn btn-secondary !rounded-full cx-press shrink-0" onClick={() => (isQuiz ? onOpenQuiz(e.id) : onOpenCoding(e.id))}>
                    {t('learn.doExercise')} <i className="ph ph-arrow-right" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--color-divider)' }}>
        <button className="btn btn-secondary cx-press" disabled>
          <i className="ph ph-arrow-left" aria-hidden /> {t('learn.prevLesson')}
        </button>
        <button className="btn btn-primary cx-press" onClick={onComplete} disabled={completing || isCompleted}>
          <i className="ph ph-check-circle" aria-hidden />
          {isCompleted ? t('progress.completed') : t('learn.markDone')}
        </button>
      </div>

      {/* Thảo luận — chưa có API bình luận → placeholder tĩnh */}
      <div className="card" style={{ borderRadius: 'var(--cx-radius)' }}>
        <p className="card-title cx-display" style={{ fontSize: 15 }}>{t('learn.discussion')}</p>
        <div className="mt-1 flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: 'linear-gradient(150deg, var(--cx-purple), var(--cx-coral))' }}>C</span>
          <div className="rounded-2xl px-3 py-2 text-sm" style={{ background: 'var(--color-neutral-900)' }}>
            <p className="mb-0.5 text-xs font-semibold">{t('learn.discussionSampleName')}</p>
            <p className="text-muted">{t('learn.discussionSample')}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input className="input" placeholder={t('learn.discussionPlaceholder')} disabled />
          <button className="btn btn-icon btn-primary !rounded-full" disabled aria-label={t('learn.discussionPost')}>
            <i className="ph ph-paper-plane-tilt" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
