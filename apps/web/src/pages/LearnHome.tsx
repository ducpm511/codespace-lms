import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyClasses, useMyLessons, useUpdateProgress } from '../features/classes/hooks';
import { useAssignments } from '../features/assessments/hooks';
import { StudentAssignmentCard } from '../features/assessments/StudentAssignmentCard';

export function LearnHome(): JSX.Element {
  const { t } = useTranslation();
  const myClasses = useMyClasses();
  const [classId, setClassId] = useState<string | null>(null);

  // Chọn lớp đầu tiên khi tải xong.
  useEffect(() => {
    if (!classId && myClasses.data && myClasses.data.length > 0) {
      setClassId(myClasses.data[0].id);
    }
  }, [classId, myClasses.data]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">{t('learn.title')}</h1>

      {myClasses.isLoading && <p className="text-slate-500">{t('common.loading')}</p>}
      {myClasses.data?.length === 0 && <p className="text-slate-500">{t('learn.noClasses')}</p>}

      {myClasses.data && myClasses.data.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">{t('learn.selectClass')}</label>
          <select
            value={classId ?? ''}
            onChange={(e) => setClassId(e.target.value || null)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {myClasses.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {classId && (
        <div className="space-y-6">
          <Lessons classId={classId} />
          <ClassAssignments classId={classId} />
        </div>
      )}
    </section>
  );
}

function Lessons({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const lessons = useMyLessons(classId);
  const update = useUpdateProgress(classId);

  if (lessons.isLoading) return <p className="text-slate-500">{t('common.loading')}</p>;
  if (lessons.isError) return <p className="text-red-600">{t('common.error')}</p>;
  if (!lessons.data || lessons.data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
        {t('learn.noLessons')}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {lessons.data.map((l) => (
        <li
          key={l.lessonId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <div>
            <p className="font-medium">{l.title}</p>
            <p className="text-xs text-slate-400">
              {l.courseTitle} · {l.sectionTitle} · {t(`lessonType.${l.type}`, { defaultValue: l.type })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ProgressBadge status={l.progressStatus} />
            {l.progressStatus !== 'completed' && (
              <>
                {l.progressStatus === 'not_started' && (
                  <ProgressButton
                    label={t('learn.markInProgress')}
                    onClick={() => update.mutate({ lessonId: l.lessonId, status: 'in_progress' })}
                    disabled={update.isPending}
                  />
                )}
                <ProgressButton
                  label={t('learn.markCompleted')}
                  onClick={() => update.mutate({ lessonId: l.lessonId, status: 'completed' })}
                  disabled={update.isPending}
                  primary
                />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ClassAssignments({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const assignments = useAssignments();

  if (assignments.isLoading) return <p className="text-xs text-slate-400">{t('common.loading')}</p>;
  if (!assignments.data || assignments.data.items.length === 0) return <></>;

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <h2 className="text-base font-semibold text-slate-800">{t('assignments.heading')}</h2>
      <div className="space-y-3">
        {assignments.data.items.map((a) => (
          <StudentAssignmentCard key={a.id} classId={classId} assignment={a} />
        ))}
      </div>
    </div>
  );
}

function ProgressButton({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2.5 py-1 text-xs disabled:opacity-50 ${
        primary
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border border-slate-300 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );
}

function ProgressBadge({ status }: { status: string }): JSX.Element {
  const { t } = useTranslation();
  const cls =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'in_progress'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-500';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>
      {t(`progress.${status}`, { defaultValue: status })}
    </span>
  );
}
