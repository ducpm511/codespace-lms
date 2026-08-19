import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassCourseDto, ClassMemberDto, ClassMemberRoleValue, ClassReportDto } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useUserLookup } from '../../features/users/lookup';
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
import { useClassReport, useClassReports } from '../../features/reports/useClassReport';
import {
  DetailColumn,
  DetailHeader,
  DetailSection,
  EmptyHint,
  IconTile,
  PillButton,
  ProgressBar,
  Sidebar,
  SidebarCard,
  TeachShell,
} from './teachUi';

const ERROR_COLOR = '#f4a3a3';
const CLASS_COLOR = 'var(--cx-teal)';

export function TeachClasses(): JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const classes = useClasses();

  const classIds = useMemo(() => (classes.data?.items ?? []).map((c) => c.id), [classes.data]);
  // Dùng chung cache với hero Giảng dạy → không phát sinh request mới.
  const reports = useClassReports(classIds);
  const reportById = useMemo(() => {
    const m = new Map<string, ClassReportDto>();
    reports.forEach((r) => {
      if (r.data) m.set(r.data.classId, r.data);
    });
    return m;
  }, [reports]);

  return (
    <TeachShell
      sidebar={
        <Sidebar
          icon="ph-users-three"
          color={CLASS_COLOR}
          title={t('classes.heading')}
          count={classes.data?.total}
          footer={
            creating ? (
              <CreateClassForm
                onCancel={() => setCreating(false)}
                onCreated={(id) => {
                  setSelected(id);
                  setCreating(false);
                }}
              />
            ) : (
              <PillButton icon="ph-plus" onClick={() => setCreating(true)}>
                {t('classes.create')}
              </PillButton>
            )
          }
        >
          {classes.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
          {classes.data?.items.length === 0 && <EmptyHint icon="ph-users-three">{t('classes.empty')}</EmptyHint>}
          {classes.data?.items.map((c) => {
            const report = reportById.get(c.id);
            return (
              <SidebarCard
                key={c.id}
                icon="ph-users-three"
                color={CLASS_COLOR}
                title={c.name}
                meta={
                  report
                    ? `${c.code} · ${t('classes.studentCount', { count: report.totalStudents })}`
                    : c.code
                }
                selected={selected === c.id}
                onClick={() => setSelected(c.id)}
              >
                {report && (
                  <span className="flex w-full items-center gap-2">
                    <ProgressBar value={report.courseCompletionRate} />
                    <span className="text-muted shrink-0" style={{ fontSize: 11 }}>
                      {report.courseCompletionRate}%
                    </span>
                  </span>
                )}
              </SidebarCard>
            );
          })}
        </Sidebar>
      }
    >
      {selected ? (
        <ClassDetailPanel classId={selected} />
      ) : (
        <EmptyHint icon="ph-hand-pointing">{t('classes.selectHint')}</EmptyHint>
      )}
    </TeachShell>
  );
}

function CreateClassForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}): JSX.Element {
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
      style={{ borderRadius: 18 }}
    >
      <p className="cx-display m-0" style={{ fontSize: 14 }}>
        {t('classes.create')}
      </p>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('classes.name')} required />
      <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('classes.code')} required />
      <div className="flex gap-2">
        <PillButton type="submit" icon="ph-plus" disabled={create.isPending}>
          {t('classes.add')}
        </PillButton>
        <PillButton variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </PillButton>
      </div>
      {create.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(create.error)}</p>}
    </form>
  );
}

function ClassDetailPanel({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'manage' | 'report'>('manage');
  const cls = useClass(classId);
  const report = useClassReport(classId);

  if (cls.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (cls.isError || !cls.data) return <p className="text-sm" style={{ color: ERROR_COLOR }}>{t('common.error')}</p>;
  const c = cls.data;
  const rate = report.data?.courseCompletionRate;

  return (
    <DetailColumn>
      <DetailHeader
        icon="ph-users-three"
        color={CLASS_COLOR}
        title={c.name}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t('classes.codeLabel', { code: c.code })}</span>
            {report.data && (
              <>
                <span aria-hidden>·</span>
                <span>{t('classes.studentCount', { count: report.data.totalStudents })}</span>
              </>
            )}
          </span>
        }
        actions={<span className="tag tag-accent">{t(`classStatus.${c.status}`, { defaultValue: c.status })}</span>}
      >
        {rate !== undefined && (
          <div className="flex flex-col gap-1.5">
            <ProgressBar value={rate} height={8} />
            <p className="text-muted m-0" style={{ fontSize: 11 }}>
              {t('classes.avgProgress', { rate })}
            </p>
          </div>
        )}

        <div className="seg flex-wrap">
          <button className={`seg-btn cx-press ${tab === 'manage' ? 'seg-active' : ''}`} onClick={() => setTab('manage')}>
            <i className="ph ph-gear" aria-hidden /> {t('classes.manageTab')}
          </button>
          <button className={`seg-btn cx-press ${tab === 'report' ? 'seg-active' : ''}`} onClick={() => setTab('report')}>
            <i className="ph ph-chart-bar" aria-hidden /> {t('classes.reportTab')}
          </button>
        </div>
      </DetailHeader>

      {tab === 'manage' && (
        <>
          <DetailSection icon="ph-books" color="var(--cx-blue)" title={t('classes.coursesAndMembers')}>
            <div className="grid gap-4 xl:grid-cols-2">
              <CoursesPanel classId={classId} courses={c.courses} />
              <MembersPanel classId={classId} members={c.members} />
            </div>
          </DetailSection>

          <GatesPanel classId={classId} assignedCourses={c.courses} />
        </>
      )}

      {tab === 'report' && <ClassReportPanel classId={classId} />}
    </DetailColumn>
  );
}

function ClassReportPanel({ classId }: { classId: string }): JSX.Element {
  const { t } = useTranslation();
  const { data: report, isLoading, isError } = useClassReport(classId);

  if (isLoading) return <p className="text-muted py-6 text-sm">{t('classes.reportLoading')}</p>;
  if (isError || !report) {
    return <p className="py-6 text-sm" style={{ color: ERROR_COLOR }}>{t('classes.reportError')}</p>;
  }

  const kpis = [
    {
      icon: 'ph-users-three',
      color: 'var(--cx-blue)',
      label: t('classes.kpiStudents'),
      value: String(report.totalStudents),
      hint: t('classes.kpiStudentsHint', { count: report.activeStudents }),
      hintColor: 'var(--cx-teal)',
    },
    {
      icon: 'ph-chart-line-up',
      color: 'var(--cx-amber)',
      label: t('classes.kpiCompletion'),
      value: `${report.courseCompletionRate}%`,
      hint: t('classes.kpiCompletionHint'),
    },
    {
      icon: 'ph-star',
      color: 'var(--cx-teal)',
      label: t('classes.kpiAvgScore'),
      value: String(report.avgFinalScore),
      hint: t('classes.kpiAvgScoreHint'),
    },
    {
      icon: 'ph-certificate',
      color: 'var(--cx-purple)',
      label: t('classes.kpiCertificates'),
      value: String(report.totalCertificatesIssued),
      hint: t('classes.kpiCertificatesHint'),
    },
  ];

  return (
    <DetailColumn>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card cx-lift" style={{ borderRadius: 18, padding: 'var(--space-5)', gap: 8 }}>
            <div className="flex items-center gap-2.5">
              <IconTile icon={k.icon} color={k.color} size={34} />
              <p className="text-muted m-0" style={{ fontSize: 11 }}>
                {k.label}
              </p>
            </div>
            <p className="cx-display m-0" style={{ fontSize: 26, lineHeight: 1.1, color: k.color }}>
              {k.value}
            </p>
            <p className="text-muted m-0" style={{ fontSize: 11, color: k.hintColor }}>
              {k.hint}
            </p>
          </div>
        ))}
      </div>

      <DetailSection icon="ph-chart-bar" color="var(--cx-coral)" title={t('classes.gradeDistribution')}>
        <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)' }}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {report.gradeDistribution.map((gd) => (
              <div
                key={gd.range}
                className="text-center"
                style={{
                  borderRadius: 14,
                  padding: 'var(--space-4)',
                  background: 'color-mix(in srgb, var(--color-text) 5%, transparent)',
                  boxShadow: 'inset 0 0 0 1px var(--color-divider)',
                }}
              >
                <span className="text-muted font-mono" style={{ fontSize: 11 }}>
                  {t('classes.scoreRange', { range: gd.range })}
                </span>
                <p className="cx-display m-0" style={{ fontSize: 18, marginTop: 4 }}>
                  {gd.count}{' '}
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    {t('classes.studentsUnit')}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </DetailSection>

      <DetailSection
        icon="ph-list-checks"
        color="var(--cx-amber)"
        title={t('classes.lessonProgressHeading')}
        count={report.lessonProgressStats.length}
      >
        <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
          {report.lessonProgressStats.length === 0 ? (
            <p className="text-muted m-0 py-2 text-xs">{t('classes.noGatesOpen')}</p>
          ) : (
            report.lessonProgressStats.map((stat) => (
              <div key={stat.lessonId} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate">{stat.title}</span>
                  <span className="shrink-0 font-mono" style={{ color: 'var(--cx-amber)' }}>
                    {stat.completedCount}/{report.totalStudents} · {stat.completionRate}%
                  </span>
                </div>
                <ProgressBar value={stat.completionRate} height={8} />
              </div>
            ))
          )}
        </div>
      </DetailSection>
    </DetailColumn>
  );
}

function CoursesPanel({ classId, courses }: { classId: string; courses: ClassCourseDto[] }): JSX.Element {
  const { t } = useTranslation();
  const allCourses = useCourses();
  const assign = useAssignCourse(classId);
  const [courseId, setCourseId] = useState('');

  return (
    <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
      <p className="cx-display m-0" style={{ fontSize: 15 }}>
        {t('classes.courses')}
      </p>

      <div className="flex flex-col gap-2">
        {courses.map((cc) => (
          <div
            key={cc.id}
            className="flex items-center gap-2.5"
            style={{
              borderRadius: 14,
              padding: '8px 12px',
              background: 'color-mix(in srgb, var(--cx-blue) 12%, transparent)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--cx-blue) 30%, transparent)',
            }}
          >
            <i className="ph-fill ph-book-bookmark shrink-0" style={{ color: 'var(--cx-blue)' }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">{cc.title}</span>
          </div>
        ))}
        {courses.length === 0 && <p className="text-muted m-0 text-xs">{t('classes.noCourses')}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (courseId) assign.mutate({ courseId }, { onSuccess: () => setCourseId('') });
        }}
        className="flex flex-wrap items-center gap-2"
        style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-4)' }}
      >
        <select
          className="input min-w-[160px] flex-1"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          required
        >
          <option value="">{t('classes.selectCourse')}</option>
          {allCourses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <PillButton type="submit" icon="ph-link" disabled={assign.isPending}>
          {t('classes.assignCourse')}
        </PillButton>
      </form>
      {assign.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(assign.error)}</p>}
    </div>
  );
}

/** Màu avatar chữ cái đầu — quay vòng theo bảng màu category để mỗi người một tông. */
const AVATAR_COLORS = ['var(--cx-purple)', 'var(--cx-teal)', 'var(--cx-amber)', 'var(--cx-coral)', 'var(--cx-blue)'];

function MembersPanel({ classId, members }: { classId: string; members: ClassMemberDto[] }): JSX.Element {
  const { t } = useTranslation();
  const enroll = useEnrollMember(classId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ClassMemberRoleValue>('student');
  // Tra userId từ email thay vì bắt giáo viên nhập id thô (giáo viên không có quyền `user.read`).
  const lookup = useUserLookup(email);
  const found = lookup.data;
  // `members[].id` là id của ClassMember, không phải userId → đối chiếu bằng email (email là unique).
  const alreadyMember = !!found && members.some((m) => m.email.toLowerCase() === found.email.toLowerCase());

  return (
    <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
      <p className="cx-display m-0" style={{ fontSize: 15 }}>
        {t('classes.members')}
      </p>

      <div className="flex flex-col gap-2">
        {members.map((m, i) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const name = m.fullName || m.email;
          return (
            <div key={m.id} className="flex items-center gap-2.5">
              <span
                className="cx-display flex shrink-0 items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  fontSize: 13,
                  color,
                  background: `color-mix(in srgb, ${color} 20%, transparent)`,
                }}
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              <span className="tag tag-neutral shrink-0">
                {t(`roleInClass.${m.roleInClass}`, { defaultValue: m.roleInClass })}
              </span>
            </div>
          );
        })}
        {members.length === 0 && <p className="text-muted m-0 text-xs">{t('classes.noMembers')}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!found) return;
          enroll.mutate({ userId: found.id, roleInClass: role }, { onSuccess: () => setEmail('') });
        }}
        className="flex flex-col gap-2"
        style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-4)' }}
      >
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('classes.memberEmail')}
          required
        />

        {/* Xác nhận đúng người trước khi thêm — tránh thêm nhầm do gõ sai email. */}
        {lookup.isFetching && <p className="text-muted m-0 text-xs">{t('classes.lookingUp')}</p>}
        {found && (
          <p className="m-0 text-xs" style={{ color: alreadyMember ? undefined : 'var(--color-accent-300)' }}>
            <i className={`ph ${alreadyMember ? 'ph-info' : 'ph-user-check'}`} aria-hidden />{' '}
            {alreadyMember
              ? t('classes.alreadyMember', { name: found.fullName || found.email })
              : t('classes.foundUser', { name: found.fullName || found.email })}
          </p>
        )}
        {lookup.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{t('classes.userNotFound')}</p>}

        <div className="flex flex-wrap gap-2">
          <select
            className="input min-w-[120px] flex-1"
            value={role}
            onChange={(e) => setRole(e.target.value as ClassMemberRoleValue)}
          >
            <option value="student">{t('roleInClass.student')}</option>
            <option value="ta">{t('roleInClass.ta')}</option>
            <option value="instructor">{t('roleInClass.instructor')}</option>
          </select>
          <PillButton type="submit" icon="ph-user-plus" disabled={enroll.isPending || !found || alreadyMember}>
            {t('classes.enroll')}
          </PillButton>
        </div>
      </form>
      {enroll.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(enroll.error)}</p>}
    </div>
  );
}

function GatesPanel({
  classId,
  assignedCourses,
}: {
  classId: string;
  assignedCourses: ClassCourseDto[];
}): JSX.Element {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const courseId = picked ?? assignedCourses[0]?.courseId ?? null;
  const course = useCourse(courseId);
  const gates = useGates(classId);
  const setGate = useSetGate(classId);

  const activeSet = new Set(gates.data?.filter((g) => g.isActive).map((g) => g.lessonId));

  return (
    <DetailSection icon="ph-lock-open" color="var(--cx-amber)" title={t('classes.lessonGates')}>
      {assignedCourses.length === 0 ? (
        <EmptyHint icon="ph-lock">{t('classes.gatesNeedCourse')}</EmptyHint>
      ) : (
        <>
          <div className="card" style={{ borderRadius: 18, padding: 'var(--space-5)' }}>
            <div className="field">
              <label>{t('classes.gateCoursePicker')}</label>
              <select className="input" value={courseId ?? ''} onChange={(e) => setPicked(e.target.value || null)}>
                {assignedCourses.map((cc) => (
                  <option key={cc.courseId} value={cc.courseId}>
                    {cc.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {course.data?.sections.map((s) => (
            <div key={s.id} className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-2)' }}>
              <p className="cx-display m-0" style={{ fontSize: 14 }}>
                {s.title}
              </p>
              {s.lessons.length === 0 && <p className="text-muted m-0 text-xs">{t('courses.noLessons')}</p>}
              {s.lessons.map((l) => {
                const on = activeSet.has(l.id);
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-3"
                    style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3) 0' }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
                    <span className="text-muted shrink-0" style={{ fontSize: 11 }}>
                      {on ? t('classes.gateOpen') : t('classes.gateClosed')}
                    </span>
                    <GateToggle
                      on={on}
                      label={on ? t('classes.gateOpen') : t('classes.gateClosed')}
                      disabled={setGate.isPending}
                      onChange={(v) => setGate.mutate({ lessonId: l.id, isActive: v })}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
      {setGate.isError && <p className="m-0 text-xs" style={{ color: ERROR_COLOR }}>{errMsg(setGate.error)}</p>}
    </DetailSection>
  );
}

function GateToggle({
  on,
  label,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="cx-toggle shrink-0" aria-label={label}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="cx-toggle-thumb" />
    </label>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
