import type { LessonActivityTypeValue } from '@lms/contracts';

/** Icon + màu category cho từng loại activity (bám token playful `--cx-*`). */
export const ACTIVITY_META: Record<LessonActivityTypeValue, { icon: string; color: string }> = {
  markdown: { icon: 'ph-article', color: 'var(--cx-blue)' },
  pdf: { icon: 'ph-file-pdf', color: 'var(--cx-coral)' },
  video: { icon: 'ph-video-camera', color: 'var(--cx-purple)' },
  quiz: { icon: 'ph-check-square-offset', color: 'var(--cx-coral)' },
  coding: { icon: 'ph-code', color: 'var(--cx-teal)' },
  assignment: { icon: 'ph-target', color: 'var(--cx-amber)' },
};

export function activityMeta(type: string): { icon: string; color: string } {
  return ACTIVITY_META[type as LessonActivityTypeValue] ?? { icon: 'ph-book-bookmark', color: 'var(--cx-purple)' };
}
