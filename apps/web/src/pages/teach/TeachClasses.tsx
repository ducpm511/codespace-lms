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

export function TeachClasses(): JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const classes = useClasses();

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-4">
        <CreateClassForm onCreated={(id) => setSelected(id)} />
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-sm font-medium">
            {t('classes.heading')}
            {classes.data && <span className="ml-2 text-slate-400">({classes.data.total})</span>}
          </div>
          {classes.isLoading && <p className="px-3 py-4 text-sm text-slate-500">{t('common.loading')}</p>}
          {classes.data?.items.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-500">{t('classes.empty')}</p>
          )}
          <ul>
            {classes.data?.items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    selected === c.id ? 'bg-slate-100 font-medium' : ''
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.code}</span>
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
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
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
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      <p className="text-sm font-medium">{t('classes.create')}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('classes.name')}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t('classes.code')}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={create.isPending}
        className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {t('classes.add')}
      </button>
      {create.isError && <p className="text-xs text-red-600">{errMsg(create.error)}</p>}
    </form>
  );
}

function ClassDetailPanel({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const cls = useClass(classId);
  if (cls.isLoading) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  if (cls.isError || !cls.data) return <p className="text-sm text-red-600">{t('common.error')}</p>;
  const c = cls.data;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{c.name}</h2>
        <p className="text-xs text-slate-400">{c.code}</p>
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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-medium">{t('classes.courses')}</p>
      <ul className="mb-2 space-y-1 text-sm">
        {courses.map((cc) => (
          <li key={cc.id} className="rounded bg-slate-50 px-2 py-1">
            {cc.title}
          </li>
        ))}
        {courses.length === 0 && <li className="text-xs text-slate-400">{t('classes.noCourses')}</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (courseId) assign.mutate({ courseId }, { onSuccess: () => setCourseId('') });
        }}
        className="flex gap-2"
      >
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          required
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">{t('classes.selectCourse')}</option>
          {allCourses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={assign.isPending}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          {t('classes.assignCourse')}
        </button>
      </form>
      {assign.isError && <p className="mt-1 text-xs text-red-600">{errMsg(assign.error)}</p>}
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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-medium">{t('classes.members')}</p>
      <ul className="mb-2 space-y-1 text-sm">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
            <span className="truncate">{m.fullName || m.email}</span>
            <span className="text-xs text-slate-400">{t(`roleInClass.${m.roleInClass}`, { defaultValue: m.roleInClass })}</span>
          </li>
        ))}
        {members.length === 0 && <li className="text-xs text-slate-400">{t('classes.noMembers')}</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enroll.mutate({ userId: userId.trim(), roleInClass: role }, { onSuccess: () => setUserId('') });
        }}
        className="space-y-2"
      >
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder={t('classes.userId')}
          required
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ClassMemberRoleValue)}
            className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="student">{t('roleInClass.student')}</option>
            <option value="ta">{t('roleInClass.ta')}</option>
            <option value="instructor">{t('roleInClass.instructor')}</option>
          </select>
          <button
            type="submit"
            disabled={enroll.isPending}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            {t('classes.enroll')}
          </button>
        </div>
      </form>
      {enroll.isError && <p className="mt-1 text-xs text-red-600">{errMsg(enroll.error)}</p>}
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
  // Mặc định khóa đầu tiên khi chưa chọn (state khởi tạo trước khi lớp có khóa).
  const courseId = picked ?? assignedCourses[0]?.courseId ?? null;
  const course = useCourse(courseId);
  const gates = useGates(classId);
  const setGate = useSetGate(classId);

  const activeSet = new Set(gates.data?.filter((g) => g.isActive).map((g) => g.lessonId));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-medium">{t('classes.lessonGates')}</p>
      {assignedCourses.length === 0 ? (
        <p className="text-xs text-slate-400">{t('classes.gatesNeedCourse')}</p>
      ) : (
        <>
          <select
            value={courseId ?? ''}
            onChange={(e) => setPicked(e.target.value || null)}
            className="mb-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm md:w-72"
          >
            {assignedCourses.map((cc) => (
              <option key={cc.courseId} value={cc.courseId}>
                {cc.title}
              </option>
            ))}
          </select>
          {course.data?.sections.map((s) => (
            <div key={s.id} className="mb-2">
              <p className="text-xs font-medium text-slate-500">{s.title}</p>
              <ul className="divide-y divide-slate-100">
                {s.lessons.map((l) => {
                  const on = activeSet.has(l.id);
                  return (
                    <li key={l.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span>{l.title}</span>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
                        {on ? t('classes.gateOpen') : t('classes.gateClosed')}
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={setGate.isPending}
                          onChange={(e) => setGate.mutate({ lessonId: l.id, isActive: e.target.checked })}
                          className="h-4 w-4"
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}
      {setGate.isError && <p className="mt-1 text-xs text-red-600">{errMsg(setGate.error)}</p>}
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
