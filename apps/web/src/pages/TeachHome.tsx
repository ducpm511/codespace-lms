import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '../features/auth/hooks';
import { useTeachOverview } from '../features/reports/useClassReport';
import { TeachCourses } from './teach/TeachCourses';
import { TeachClasses } from './teach/TeachClasses';
import { TeachAssignments } from './teach/TeachAssignments';
import { TeachCoding } from './teach/TeachCoding';
import { TeachQuiz } from './teach/TeachQuiz';
import { TeachGradebook } from './teach/TeachGradebook';

type Tab = 'courses' | 'classes' | 'assignments' | 'coding' | 'quiz' | 'gradebook';

const TABS: Tab[] = ['courses', 'classes', 'assignments', 'coding', 'quiz', 'gradebook'];
const TAB_ICON: Record<Tab, string> = {
  courses: 'ph-books',
  classes: 'ph-users-three',
  assignments: 'ph-clipboard-text',
  coding: 'ph-code',
  quiz: 'ph-check-square-offset',
  gradebook: 'ph-trophy',
};

export function TeachHome(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('courses');

  return (
    <section className="space-y-6">
      <TeacherHero />

      <div className="seg flex-wrap">
        {TABS.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`seg-btn cx-press ${tab === k ? 'seg-active' : ''}`}
          >
            <i className={`ph ${TAB_ICON[k]}`} aria-hidden />
            {t(`teach.tab_${k}`)}
          </button>
        ))}
      </div>

      {tab === 'courses' && <TeachCourses />}
      {tab === 'classes' && <TeachClasses />}
      {tab === 'assignments' && <TeachAssignments />}
      {tab === 'coding' && <TeachCoding />}
      {tab === 'quiz' && <TeachQuiz />}
      {tab === 'gradebook' && <TeachGradebook />}
    </section>
  );
}

/* ═══════════════ Teacher hero — MỘT request /teach/overview cho cả 5 con số ═══════════════ */
function TeacherHero(): JSX.Element {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const { data: overview, isLoading } = useTeachOverview();

  // Chưa có số liệu → hiện dấu gạch thay vì số 0 gây hiểu nhầm.
  const num = (v: number | undefined) => (isLoading || v === undefined ? '—' : String(v));
  const avgProgress = overview?.avgProgress ?? 0;

  const greetName = user?.fullName || user?.email || '';
  const ringTurn = avgProgress / 100;

  const stats = [
    { icon: 'ph-users-three', color: 'var(--cx-teal)', value: num(overview?.classCount), label: t('teach.statClasses') },
    { icon: 'ph-student', color: 'var(--cx-amber)', value: num(overview?.studentCount), label: t('teach.statStudents') },
    // Chip "chờ chấm" là chip thứ 3 theo design §7 — trước đây phải mượn "Khóa học"
    // vì đếm bài chờ chấm toàn cục cần fan-out qua từng lớp.
    { icon: 'ph-clipboard-text', color: 'var(--cx-coral)', value: num(overview?.pendingGradingCount), label: t('teach.statPendingGrading') },
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
      <span
        className="cx-blob"
        style={{ width: 300, height: 300, top: -90, right: 120, background: 'var(--cx-teal)', opacity: 0.4 }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 flex-1" style={{ minWidth: 280 }}>
          <p className="text-[11px] uppercase tracking-[0.12em]" style={{ opacity: 0.85 }}>{t('teach.title')}</p>
          <h1 className="cx-display my-1" style={{ fontSize: 38 }}>{t('teach.heroTitle', { name: greetName })}</h1>
          <p style={{ opacity: 0.8 }}>{t('teach.heroMotivation')}</p>
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

        {/* Ring tiến độ TB — mascot thò ra phải nên wrapper cần margin-right */}
        <div className="relative shrink-0" style={{ marginRight: 28 }}>
          <div
            className="grid place-items-center rounded-full"
            style={{
              width: 132,
              height: 132,
              background: `conic-gradient(var(--cx-amber) 0turn ${ringTurn}turn, color-mix(in srgb, #fff 12%, transparent) ${ringTurn}turn 1turn)`,
            }}
          >
            <div className="grid place-items-center rounded-full" style={{ width: 104, height: 104, background: 'var(--color-section)' }}>
              <span className="cx-display" style={{ fontSize: 28, lineHeight: 1 }}>{isLoading ? '—' : `${avgProgress}%`}</span>
              <span className="text-[11px]" style={{ opacity: 0.7 }}>{t('teach.avgProgress')}</span>
            </div>
          </div>
          <img
            src="/brand/mascot-laptop.png"
            alt=""
            aria-hidden
            className="cx-bob absolute"
            style={{ width: 92, right: -28, bottom: -12 }}
          />
        </div>
      </div>
    </div>
  );
}
