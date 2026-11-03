/** Mảnh giao diện dùng chung của tab Bài lập trình: phần biên soạn (TeachCoding) và phần xem bài nộp. */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CodingProblemSummary } from '@lms/contracts';
import type { ChapterGroup } from './codingGroups';

/** Màu category theo độ khó. */
const DIFF_COLOR: Record<string, string> = {
  easy: 'var(--cx-teal)',
  medium: 'var(--cx-amber)',
  hard: 'var(--cx-coral)',
};
export const diffColor = (d: string) => DIFF_COLOR[d] ?? 'var(--cx-purple)';

/** Một chương thu gọn được (cùng kiểu header chương với LessonsByChapter bên Học tập), trong đó nhóm theo bài học. */
export function ChapterBlock({
  chapter,
  open,
  onToggle,
  renderProblem,
}: {
  chapter: ChapterGroup;
  open: boolean;
  /** Không truyền = đang lọc, chương luôn mở. */
  onToggle?: () => void;
  renderProblem: (problem: CodingProblemSummary) => ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const title = chapter.title ?? t('coding.unassignedGroup');
  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
      <button
        type="button"
        className="cx-press flex w-full items-center gap-2 text-left"
        onClick={onToggle}
        disabled={!onToggle}
        aria-expanded={open}
      >
        <i
          className={`ph ${open ? 'ph-caret-down' : 'ph-caret-right'} shrink-0 text-base`}
          style={{ color: 'var(--color-accent)' }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold uppercase tracking-[0.06em]" title={title}>
          {title}
        </span>
        <span className="tag tag-neutral shrink-0">{chapter.total}</span>
      </button>

      {open &&
        chapter.lessons.map((lesson) => (
          <div key={lesson.lessonId ?? 'none'} className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
            {lesson.lessonTitle && (
              <p className="text-muted m-0 flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <i className="ph ph-book-bookmark shrink-0" aria-hidden />
                <span className="min-w-0 truncate" title={lesson.lessonTitle}>
                  {lesson.lessonTitle}
                </span>
              </p>
            )}
            {lesson.problems.map(renderProblem)}
          </div>
        ))}
    </div>
  );
}

export function DifficultyTag({ difficulty }: { difficulty: string }): JSX.Element {
  const { t } = useTranslation();
  const color = diffColor(difficulty);
  return (
    <span
      className="shrink-0"
      style={{
        borderRadius: 999,
        padding: '3px 10px',
        fontSize: 11,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    >
      {t(`coding.diff_${difficulty}`, { defaultValue: difficulty })}
    </span>
  );
}

export function IoPanel({ label, value, color }: { label: string; value: string; color?: string }): JSX.Element {
  return (
    <div
      style={{
        borderRadius: 14,
        background: 'var(--color-neutral-900)',
        boxShadow: 'inset 0 0 0 1px var(--color-divider)',
        padding: 'var(--space-4)',
      }}
    >
      <p className="text-muted m-0" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <pre
        className="m-0 overflow-x-auto"
        style={{
          marginTop: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          color: color ?? 'var(--color-text)',
        }}
      >
        {value || '—'}
      </pre>
    </div>
  );
}
