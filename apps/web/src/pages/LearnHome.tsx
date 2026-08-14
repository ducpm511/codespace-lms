import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '../features/auth/hooks';
import { useMyClasses, useMyLessons, useUpdateProgress } from '../features/classes/hooks';
import { useAssignments } from '../features/assessments/hooks';
import { StudentAssignmentCard } from '../features/assessments/StudentAssignmentCard';
import { LearnQuiz } from './learn/LearnQuiz';
import { LearnCoding } from './learn/LearnCoding';

export function LearnHome(): JSX.Element {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const myClasses = useMyClasses();
  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!classId && myClasses.data && myClasses.data.length > 0) {
      setClassId(myClasses.data[0].id);
    }
  }, [classId, myClasses.data]);

  const greetName = user?.fullName || user?.email || '';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {greetName && (
            <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-accent-300)' }}>
              {t('learn.greeting', { name: greetName })}
            </p>
          )}
          <h1 className="text-xl">{t('learn.title')}</h1>
        </div>

        {myClasses.data && myClasses.data.length > 0 && (
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
      </div>

      {myClasses.isLoading && <p className="text-muted">{t('common.loading')}</p>}
      {myClasses.data?.length === 0 && <p className="text-muted">{t('learn.noClasses')}</p>}

      {classId && (
        <div className="space-y-6">
          <Lessons classId={classId} />
          <ClassAssignments classId={classId} />
          <LearnQuiz classId={classId} />
          <LearnCoding classId={classId} />
        </div>
      )}
    </section>
  );
}

function Lessons({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const lessons = useMyLessons(classId);
  const update = useUpdateProgress(classId);

  if (lessons.isLoading) return <p className="text-muted">{t('common.loading')}</p>;
  if (lessons.isError) return <p className="text-red-400">{t('common.error')}</p>;
  if (!lessons.data || lessons.data.length === 0) {
    return (
      <p className="text-muted rounded-lg border border-dashed px-4 py-10 text-center text-sm" style={{ borderColor: 'var(--color-divider)' }}>
        {t('learn.noLessons')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base">{t('learn.lessonsHeading', { defaultValue: 'Bài học' })}</h2>
      <ul className="space-y-2">
        {lessons.data.map((l) => (
          <li key={l.lessonId} className="card flex-row flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="card-title truncate">{l.title}</p>
              <p className="card-meta">
                {l.courseTitle} · {l.sectionTitle} · {t(`lessonType.${l.type}`, { defaultValue: l.type })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ProgressBadge status={l.progressStatus} />
              {l.progressStatus !== 'completed' && (
                <>
                  {l.progressStatus === 'not_started' && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => update.mutate({ lessonId: l.lessonId, status: 'in_progress' })}
                      disabled={update.isPending}
                    >
                      {t('learn.markInProgress')}
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={() => update.mutate({ lessonId: l.lessonId, status: 'completed' })}
                    disabled={update.isPending}
                  >
                    {t('learn.markCompleted')}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClassAssignments({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const assignments = useAssignments();

  if (assignments.isLoading) return <p className="text-muted text-xs">{t('common.loading')}</p>;
  if (!assignments.data || assignments.data.items.length === 0) return <></>;

  return (
    <div className="nocturne-surface space-y-3 rounded-lg p-4">
      <h2 className="text-base">{t('assignments.heading')}</h2>
      <div className="space-y-3">
        {assignments.data.items.map((a) => (
          <StudentAssignmentCard key={a.id} classId={classId} assignment={a} />
        ))}
      </div>
    </div>
  );
}

function ProgressBadge({ status }: { status: string }): JSX.Element {
  const { t } = useTranslation();
  const cls =
    status === 'completed' ? 'tag tag-accent' : status === 'in_progress' ? 'tag tag-outline' : 'tag tag-neutral';
  return <span className={cls}>{t(`progress.${status}`, { defaultValue: status })}</span>;
}
