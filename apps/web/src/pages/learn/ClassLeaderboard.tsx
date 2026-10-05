import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MANUAL_XP_MAX, MANUAL_XP_MIN, XP_REWARDS } from '@lms/contracts';
import type { LeaderboardEntryDto, LeaderboardWeek } from '@lms/contracts';
import { useClassLeaderboard } from '../../features/gamification/useGamification';

/** Số dòng hiển thị mặc định. Xem cả lớp là hành động CHỦ ĐỘNG của học viên. */
const TOP_N = 10;

/** Ba hạng đầu có màu; còn lại dùng số trơn — tránh biến cả bảng thành thang xếp loại. */
const RANK_COLOR: Record<number, string> = {
  1: 'var(--cx-amber)',
  2: 'var(--cx-blue)',
  3: 'var(--cx-coral)',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Bảng xếp hạng XP theo TUẦN trong phạm vi lớp (T10.1).
 *
 * Cố ý: phạm vi lớp (không phải toàn trường), reset mỗi thứ Hai, và chỉ số là XP — mức cố định
 * cho mỗi bài HOÀN THÀNH, không phải điểm hay tốc độ. Xếp theo tốc độ/điểm là khuyến khích chép bài.
 */
export function ClassLeaderboard({ classId }: { classId: string | null }): JSX.Element | null {
  const { t } = useTranslation();
  const [week, setWeek] = useState<LeaderboardWeek>('current');
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useClassLeaderboard(classId, week);

  if (!classId) return null;

  const weeks: Array<{ key: LeaderboardWeek; label: string }> = [
    { key: 'current', label: t('learn.leaderboardWeekCurrent') },
    { key: 'previous', label: t('learn.leaderboardWeekPrevious') },
  ];

  const entries = data?.entries ?? [];
  const visible = showAll ? entries : entries.slice(0, TOP_N);
  // Học viên ngoài tốp vẫn phải thấy dòng của chính mình — nếu không, bảng chỉ nói về người khác.
  const meOutside =
    data?.me && !visible.some((e) => e.userId === data.me?.userId) ? data.me : null;
  const noActivity = entries.length > 0 && entries.every((e) => e.xp === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{
              background: 'color-mix(in srgb, var(--cx-teal) 22%, transparent)',
              color: 'var(--cx-teal)',
            }}
          >
            <i className="ph-fill ph-ranking" aria-hidden />
          </span>
          <div>
            <h2 className="cx-display text-xl">{t('learn.leaderboardHeading')}</h2>
            {data && (
              <p className="card-meta">
                {t('learn.leaderboardRange', {
                  start: formatDay(data.weekStart),
                  end: formatDay(new Date(new Date(data.weekEnd).getTime() - 86400000).toISOString()),
                })}
              </p>
            )}
          </div>
        </div>
        <div className="seg shrink-0">
          {weeks.map((w) => (
            <button
              key={w.key}
              onClick={() => setWeek(w.key)}
              className="seg-opt"
              style={
                week === w.key
                  ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)' }
                  : undefined
              }
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-text)]/55">{t('learn.leaderboardSubtitle')}</p>

      <LeaderboardExplainer />

      {isLoading && <p className="text-muted">{t('common.loading')}</p>}

      {!isLoading && entries.length === 0 && (
        <p className="text-muted">{t('learn.leaderboardEmpty')}</p>
      )}

      {!isLoading && noActivity && (
        <p className="text-muted">{t('learn.leaderboardNoActivity')}</p>
      )}

      {entries.length > 0 && (
        <ul className="space-y-2">
          {visible.map((e) => (
            <LeaderboardRow key={e.userId} entry={e} />
          ))}
          {meOutside && (
            <>
              <li className="text-center text-xs text-[var(--color-text)]/40" aria-hidden>
                ···
              </li>
              <LeaderboardRow key={meOutside.userId} entry={meOutside} />
            </>
          )}
        </ul>
      )}

      {entries.length > TOP_N && (
        <button className="btn btn-ghost cx-press" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? t('learn.leaderboardShowTop', { count: TOP_N })
            : t('learn.leaderboardShowAll', { count: entries.length })}
        </button>
      )}
    </div>
  );
}

/**
 * Nói rõ bảng này là gì và KHÔNG là gì. Phụ huynh nhìn thấy "hạng 12/15" rất dễ hiểu thành con
 * học kém — trong khi XP chỉ đo việc chăm làm bài trên LMS. Lời miễn trừ luôn hiện; cách tính
 * gấp lại để không đè lên bảng, nhưng mở ra là thấy đủ từng nguồn XP.
 * Mức XP lấy từ `XP_REWARDS` (cùng nguồn backend dùng để cộng) — không gõ tay số vào bản dịch.
 */
function LeaderboardExplainer(): JSX.Element {
  const { t } = useTranslation();
  const rules = [
    {
      icon: 'ph-book-open-text',
      text: t('learn.leaderboardHowLesson', { xp: XP_REWARDS.lesson_complete }),
    },
    {
      icon: 'ph-check-square-offset',
      text: t('learn.leaderboardHowQuiz', { xp: XP_REWARDS.quiz_pass }),
    },
    { icon: 'ph-code', text: t('learn.leaderboardHowCoding', { xp: XP_REWARDS.coding_pass }) },
    {
      icon: 'ph-gift',
      text: t('learn.leaderboardHowBonus', { min: MANUAL_XP_MIN, max: MANUAL_XP_MAX }),
    },
  ];
  const notes = [
    t('learn.leaderboardHowOnce'),
    t('learn.leaderboardHowNotScore'),
    t('learn.leaderboardHowWeekly'),
    t('learn.leaderboardHowTotal'),
    t('learn.leaderboardHowGradebook'),
  ];

  return (
    <div
      className="space-y-3 rounded-2xl p-4"
      style={{
        background: 'color-mix(in srgb, var(--cx-amber) 8%, var(--color-surface))',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--cx-amber) 35%, transparent)',
      }}
    >
      <div className="flex items-start gap-3">
        <i className="ph-fill ph-info shrink-0 text-xl" style={{ color: 'var(--cx-amber)' }} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="card-title m-0 text-sm">{t('learn.leaderboardDisclaimerTitle')}</p>
          <p className="m-0 text-xs text-[var(--color-text)]/75">{t('learn.leaderboardDisclaimer')}</p>
        </div>
      </div>

      <details className="group">
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--cx-amber)' }}
        >
          <i className="ph ph-caret-right transition-transform group-open:rotate-90" aria-hidden />
          {t('learn.leaderboardHowTitle')}
        </summary>
        <ul className="mt-3 space-y-1.5 pl-0">
          {rules.map((r) => (
            <li key={r.icon} className="flex items-start gap-2 text-xs">
              <i className={`ph ${r.icon} mt-0.5 shrink-0`} style={{ color: 'var(--cx-teal)' }} aria-hidden />
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-text)]/70">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntryDto }): JSX.Element {
  const { t } = useTranslation();
  const rankColor = RANK_COLOR[entry.rank];

  return (
    <li
      className="cx-lift flex items-center gap-4 rounded-2xl p-4"
      style={{
        background: 'var(--color-surface)',
        boxShadow: entry.isMe ? 'inset 0 0 0 1px var(--color-accent)' : undefined,
      }}
    >
      <span
        className="cx-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
        style={{
          background: rankColor
            ? `color-mix(in srgb, ${rankColor} 22%, transparent)`
            : 'var(--color-neutral-800)',
          color: rankColor ?? 'var(--color-neutral-100)',
        }}
      >
        {entry.rank}
      </span>

      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: 'linear-gradient(150deg, var(--cx-purple), var(--cx-coral))' }}
        aria-hidden
      >
        {initials(entry.fullName)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="card-title truncate text-base">
          {entry.fullName}
          {entry.isMe && <span className="tag tag-outline ml-2">{t('learn.leaderboardYou')}</span>}
        </p>
        <p className="card-meta">
          {t('learn.leaderboardEffort', {
            lessons: entry.lessonsCompleted,
            quizzes: entry.quizzesPassed,
            coding: entry.codingPassed,
          })}
          {/* XP cô/thầy thưởng tay không nằm trong ba ô đếm trên — nói rõ nó đến từ đâu,
              nếu không dòng "0 · 0 · 0" đứng cạnh "50 XP" trông như lỗi. */}
          {entry.bonusXp > 0 && (
            <span style={{ color: 'var(--cx-amber)' }}>
              {' · '}
              <i className="ph-fill ph-gift" aria-hidden /> {t('learn.leaderboardBonus', { count: entry.bonusXp })}
            </span>
          )}
        </p>
      </div>

      <span className="cx-display shrink-0 text-base" style={{ color: 'var(--cx-teal)' }}>
        {t('learn.leaderboardXp', { count: entry.xp })}
      </span>
    </li>
  );
}
