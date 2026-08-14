import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassMemberRoleValue } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import {
  useAssignCourse,
  useClass,
  useClasses,
  useCreateClass,
  useEnrollMember,
  useGates,
  useSetGate,
} from '../../features/classes/hooks';
import { useCourse, useCourses } from '../../features/courses/hooks';

const dividerBorder = { borderColor: 'var(--color-divider)' } as const;

export function TeachClasses(): JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const classes = useClasses();

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-4">
        <CreateClassForm onCreated={(id) => setSelected(id)} />
        <div className="panel overflow-hidden">
          <div className="panel-head flex items-center gap-2">
            {t('classes.heading')}
            {classes.data && <span className="text-muted">({classes.data.total})</span>}
          </div>
          {classes.isLoading && <p className="text-muted px-3 py-4 text-sm">{t('common.loading')}</p>}
          {classes.data?.items.length === 0 && (
            <p className="text-muted px-3 py-4 text-sm">{t('classes.empty')}</p>
          )}
          <ul>
            {classes.data?.items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                  style={selected === c.id ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' } : undefined}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-muted text-xs">{c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        {selected ? (
          <ClassDetailPanel classId={selected} />
        ) : (
          <p className="text-muted rounded-lg border border-dashed px-4 py-10 text-center text-sm" style={dividerBorder}>
            {t('classes.selectHint')}
          </p>
        )}
      </div>
    </div>
  );
}

function CreateClassForm({ onCreated }: { onCreated: (id: string) => void }): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const create = useCreateClass();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(
          { name: name.trim(), code: code.trim() },
          {
            onSuccess: (c) => {
              setName('');
              setCode('');
              onCreated(c.id);
            },
          },
        );
      }}
      className="card gap-2"
    >
      <p className="card-title">{t('classes.create')}</p>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('classes.name')} required />
      <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('classes.code')} required />
      <button type="submit" disabled={create.isPending} className="btn btn-primary btn-block">
        {t('classes.add')}
      </button>
      {create.isError && <p className="text-xs text-red-400">{errMsg(create.error)}</p>}
    </form>
  );
}

function ClassDetailPanel({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const cls = useClass(classId);
  if (cls.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (cls.isError || !cls.data) return <p className="text-sm text-red-400">{t('common.error')}</p>;
  const c = cls.data;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg">{c.name}</h2>
            <p className="text-muted text-xs">{c.code}</p>
          </div>
          <span className="tag tag-outline">{t('classes.ongoing', { defaultValue: 'Đang diễn ra' })}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CoursesPanel classId={classId} courses={c.courses} />
        <MembersPanel classId={classId} members={c.members} />
      </div>

      <GatesPanel classId={classId} assignedCourses={c.courses} />
    </div>
  );
}

function CoursesPanel({
  classId,
  courses,
}: {
  classId: string;
  courses: { id: string; courseId: string; title: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const allCourses = useCourses();
  const assign = useAssignCourse(classId);
  const [courseId, setCourseId] = useState('');

  return (
    <div className="card gap-2">
      <p className="card-title text-sm">{t('classes.courses')}</p>
      <ul className="space-y-1 text-sm">
        {courses.map((cc) => (
          <li key={cc.id} className="chip">
            {cc.title}
          </li>
        ))}
        {courses.length === 0 && <li className="text-muted text-xs">{t('classes.noCourses')}</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (courseId) assign.mutate({ courseId }, { onSuccess: () => setCourseId('') });
        }}
        className="flex gap-2"
      >
        <select className="input flex-1" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
          <option value="">{t('classes.selectCourse')}</option>
          {allCourses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={assign.isPending} className="btn btn-secondary shrink-0">
          {t('classes.assignCourse')}
        </button>
      </form>
      {assign.isError && <p className="text-xs text-red-400">{errMsg(assign.error)}</p>}
    </div>
  );
}

function MembersPanel({
  classId,
  members,
}: {
  classId: string;
  members: { id: string; email: string; fullName: string; roleInClass: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const enroll = useEnrollMember(classId);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ClassMemberRoleValue>('student');

  return (
    <div className="card gap-2">
      <p className="card-title text-sm">{t('classes.members')}</p>
      <ul className="space-y-1 text-sm">
        {members.map((m) => (
          <li key={m.id} className="chip flex items-center justify-between">
            <span className="truncate">{m.fullName || m.email}</span>
            <span className="text-muted text-xs">
              {t(`roleInClass.${m.roleInClass}`, { defaultValue: m.roleInClass })}
            </span>
          </li>
        ))}
        {members.length === 0 && <li className="text-muted text-xs">{t('classes.noMembers')}</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enroll.mutate({ userId: userId.trim(), roleInClass: role }, { onSuccess: () => setUserId('') });
        }}
        className="space-y-2"
      >
        <input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('classes.userId')} required />
        <div className="flex gap-2">
          <select className="input flex-1" value={role} onChange={(e) => setRole(e.target.value as ClassMemberRoleValue)}>
            <option value="student">{t('roleInClass.student')}</option>
            <option value="ta">{t('roleInClass.ta')}</option>
            <option value="instructor">{t('roleInClass.instructor')}</option>
          </select>
          <button type="submit" disabled={enroll.isPending} className="btn btn-secondary shrink-0">
            {t('classes.enroll')}
          </button>
        </div>
      </form>
      {enroll.isError && <p className="text-xs text-red-400">{errMsg(enroll.error)}</p>}
    </div>
  );
}

function GatesPanel({
  classId,
  assignedCourses,
}: {
  classId: string;
  assignedCourses: { courseId: string; title: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const courseId = picked ?? assignedCourses[0]?.courseId ?? null;
  const course = useCourse(courseId);
  const gates = useGates(classId);
  const setGate = useSetGate(classId);

  const activeSet = new Set(gates.data?.filter((g) => g.isActive).map((g) => g.lessonId));

  return (
    <div className="card gap-2">
      <p className="card-title text-sm">{t('classes.lessonGates')}</p>
      {assignedCourses.length === 0 ? (
        <p className="text-muted text-xs">{t('classes.gatesNeedCourse')}</p>
      ) : (
        <>
          <select
            className="input md:w-72"
            value={courseId ?? ''}
            onChange={(e) => setPicked(e.target.value || null)}
          >
            {assignedCourses.map((cc) => (
              <option key={cc.courseId} value={cc.courseId}>
                {cc.title}
              </option>
            ))}
          </select>
          {course.data?.sections.map((s) => (
            <div key={s.id} className="mt-1">
              <p className="text-muted text-xs font-medium">{s.title}</p>
              <ul>
                {s.lessons.map((l) => {
                  const on = activeSet.has(l.id);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between py-1.5 text-sm"
                      style={{ borderTop: '1px solid var(--color-divider)' }}
                    >
                      <span>{l.title}</span>
                      <GateToggle
                        on={on}
                        disabled={setGate.isPending}
                        onChange={(v) => setGate.mutate({ lessonId: l.id, isActive: v })}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}
      {setGate.isError && <p className="text-xs text-red-400">{errMsg(setGate.error)}</p>}
    </div>
  );
}

function GateToggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? 'var(--color-accent)' : 'var(--color-neutral-700)' }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(15px)' : 'translateX(1px)' }}
      />
    </button>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
