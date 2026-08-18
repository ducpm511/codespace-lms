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
          <ul className="space-y-1 p-2">
            {classes.data?.items.map((c) => {
              const active = selected === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className="cx-lift flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left"
                    style={
                      active
                        ? { background: 'var(--color-accent-900)', boxShadow: 'inset 0 0 0 1px var(--color-accent-700)' }
                        : undefined
                    }
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'color-mix(in srgb, var(--cx-purple) 22%, transparent)', color: 'var(--cx-purple)' }}
                    >
                      <i className="ph-fill ph-users-three" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" style={active ? { color: 'var(--color-accent-100)' } : undefined}>{c.name}</span>
                      <span className="text-muted block truncate text-xs">{c.code}</span>
                    </span>
                  </button>
                </li>
              );
            })}
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

import { useClassReport } from '../../features/reports/useClassReport';

function ClassDetailPanel({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'manage' | 'report'>('manage');
  const cls = useClass(classId);
  if (cls.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (cls.isError || !cls.data) return <p className="text-sm text-red-400">{t('common.error')}</p>;
  const c = cls.data;

  return (
    <div className="space-y-4">
      <div className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="cx-display text-xl">{c.name}</h2>
            <p className="text-muted text-xs">{c.code}</p>
          </div>
          <div className="seg">
            <button
              className={`seg-btn cx-press ${tab === 'manage' ? 'seg-active' : ''}`}
              onClick={() => setTab('manage')}
            >
              <i className="ph ph-gear mr-1.5" aria-hidden /> Quản lý lớp
            </button>
            <button
              className={`seg-btn cx-press ${tab === 'report' ? 'seg-active' : ''}`}
              onClick={() => setTab('report')}
            >
              <i className="ph ph-chart-bar mr-1.5" aria-hidden /> Báo cáo & Thống kê
            </button>
          </div>
        </div>
      </div>

      {tab === 'manage' && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <CoursesPanel classId={classId} courses={c.courses} />
            <MembersPanel classId={classId} members={c.members} />
          </div>

          <GatesPanel classId={classId} assignedCourses={c.courses} />
        </>
      )}

      {tab === 'report' && <ClassReportPanel classId={classId} />}
    </div>
  );
}

function ClassReportPanel({ classId }: { classId: string }): JSX.Element {
  const { data: report, isLoading, isError } = useClassReport(classId);

  if (isLoading) return <p className="text-muted text-sm py-6">Đang tải báo cáo...</p>;
  if (isError || !report) return <p className="text-sm text-red-400 py-6">Không thể tải báo cáo lớp học.</p>;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 rounded-xl text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}>
          <p className="text-muted text-xs">Tổng học viên</p>
          <p className="cx-display text-2xl mt-1">{report.totalStudents}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cx-teal)' }}>{report.activeStudents} đang hoạt động</p>
        </div>
        <div className="card p-4 rounded-xl text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}>
          <p className="text-muted text-xs">Tỷ lệ hoàn thành</p>
          <p className="cx-display text-2xl mt-1" style={{ color: 'var(--cx-amber)' }}>{report.courseCompletionRate}%</p>
          <p className="text-muted text-[11px] mt-1">trên các bài đã mở</p>
        </div>
        <div className="card p-4 rounded-xl text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}>
          <p className="text-muted text-xs">Điểm TB lớp</p>
          <p className="cx-display text-2xl mt-1" style={{ color: 'var(--cx-teal)' }}>{report.avgFinalScore}</p>
          <p className="text-muted text-[11px] mt-1">thang điểm 100</p>
        </div>
        <div className="card p-4 rounded-xl text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}>
          <p className="text-muted text-xs">Chứng chỉ đã cấp</p>
          <p className="cx-display text-2xl mt-1" style={{ color: 'var(--cx-purple)' }}>{report.totalCertificatesIssued}</p>
          <p className="text-muted text-[11px] mt-1">chứng nhận hoàn thành</p>
        </div>
      </div>

      {/* Phân phối điểm số */}
      <div className="card rounded-xl p-4 text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}>
        <p className="card-title text-sm font-semibold mb-3">Phân phối điểm số</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {report.gradeDistribution.map((gd) => (
            <div key={gd.range} className="p-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-text) 5%, transparent)', border: '1px solid var(--color-divider)' }}>
              <span className="text-muted text-xs font-mono">{gd.range} điểm</span>
              <p className="cx-display text-lg mt-1">{gd.count} <span className="text-muted text-xs font-normal">học viên</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Tiến độ hoàn thành từng bài */}
      <div className="card rounded-xl p-4 text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)' }}>
        <p className="card-title text-sm font-semibold mb-3">Tiến độ bài học đã mở ({report.lessonProgressStats.length})</p>
        {report.lessonProgressStats.length === 0 ? (
          <p className="text-muted text-xs py-4">Chưa có bài học nào được mở gate cho lớp này.</p>
        ) : (
          <div className="space-y-3">
            {report.lessonProgressStats.map((stat) => (
              <div key={stat.lessonId} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium truncate max-w-md">{stat.title}</span>
                  <span className="font-mono shrink-0" style={{ color: 'var(--cx-amber)' }}>{stat.completedCount}/{report.totalStudents} ({stat.completionRate}%)</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--color-neutral-800)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${stat.completionRate}%`,
                      background: 'linear-gradient(90deg, var(--cx-amber), var(--cx-teal))',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    <label className="cx-toggle" aria-label={on ? 'Đang mở' : 'Đang khóa'}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="cx-toggle-thumb" />
    </label>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
