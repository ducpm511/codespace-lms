import type { GradeSourceType, MyCodingStatusDto, MyLessonDto, StudentOwnGradebookDto } from '@lms/contracts';

/* Logic thuần của trang /learn (nhóm, lọc, tóm tắt) — tách khỏi component để test được. */

/** Màu + icon theo loại bài tập/nguồn điểm, dùng chung cho danh sách bài tập và kết quả học tập. */
export const EXERCISE_KIND_META: Record<string, { icon: string; color: string }> = {
  quiz: { icon: 'ph-check-square-offset', color: 'var(--cx-coral)' },
  coding: { icon: 'ph-code', color: 'var(--cx-teal)' },
  assignment: { icon: 'ph-target', color: 'var(--cx-amber)' },
};

/** Bài tập trộn quiz + lập trình như học viên thấy trong lớp. */
export type Exercise =
  | { kind: 'quiz'; id: string; title: string; lessonId?: string | null; questionCount: number; maxScore: number }
  | {
      kind: 'coding';
      id: string;
      title: string;
      lessonId?: string | null;
      difficulty: string;
      maxScore: number;
      myStatus: MyCodingStatusDto | null;
    };

export type ExerciseKindFilter = 'all' | 'quiz' | 'coding';
export type ExerciseStatusFilter = 'todo' | 'done' | 'all';

/** Khóa nhóm cho bài tập không gắn bài học (hoặc gắn bài học chưa mở) — luôn xếp cuối. */
export const GENERAL_GROUP = '__general__';

/** Điểm quiz của học viên, lấy từ sổ điểm của chính em (`sourceId` = id quiz). */
export function quizScoresFrom(gradebook: StudentOwnGradebookDto | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!gradebook) return m;
  for (const item of gradebook.items) {
    if (item.sourceType !== 'quiz') continue;
    const score = gradebook.grades[item.id];
    if (score !== null && score !== undefined) m.set(item.sourceId, score);
  }
  return m;
}

/**
 * "Đã xong" = bài lập trình đã đạt, hoặc quiz đã có điểm. Bài lập trình nộp mà chưa đạt vẫn là "cần làm",
 * vì em còn phải sửa và nộp lại.
 */
export function isExerciseDone(e: Exercise, quizScores: Map<string, number>): boolean {
  if (e.kind === 'coding') return Boolean(e.myStatus?.passed);
  return quizScores.has(e.id);
}

export function filterExercises(
  exercises: Exercise[],
  kind: ExerciseKindFilter,
  status: ExerciseStatusFilter,
  quizScores: Map<string, number>,
): Exercise[] {
  return exercises.filter((e) => {
    if (kind !== 'all' && e.kind !== kind) return false;
    if (status === 'all') return true;
    return isExerciseDone(e, quizScores) === (status === 'done');
  });
}

export interface ExerciseGroup {
  /** Tiêu đề chương, hoặc `GENERAL_GROUP`. */
  key: string;
  items: Exercise[];
}

/**
 * Nhóm theo chương, theo thứ tự bài học của khóa (danh sách `lessons` đã xếp sẵn). Trong chương: theo thứ tự
 * bài học, cùng bài thì giữ thứ tự gốc. Bài không gắn bài học nào đang mở dồn về nhóm chung ở cuối.
 */
export function groupExercisesByChapter(exercises: Exercise[], lessons: MyLessonDto[]): ExerciseGroup[] {
  const lessonIndex = new Map<string, number>();
  const chapterOfLesson = new Map<string, string>();
  const chapterOrder: string[] = [];
  lessons.forEach((l, i) => {
    lessonIndex.set(l.lessonId, i);
    const key = l.sectionTitle || GENERAL_GROUP;
    chapterOfLesson.set(l.lessonId, key);
    if (!chapterOrder.includes(key)) chapterOrder.push(key);
  });

  const buckets = new Map<string, Array<{ e: Exercise; order: number; seq: number }>>();
  exercises.forEach((e, seq) => {
    const key = (e.lessonId && chapterOfLesson.get(e.lessonId)) || GENERAL_GROUP;
    const order = e.lessonId ? lessonIndex.get(e.lessonId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ e, order, seq });
  });

  const keys = chapterOrder.filter((k) => k !== GENERAL_GROUP && buckets.has(k));
  if (buckets.has(GENERAL_GROUP)) keys.push(GENERAL_GROUP);
  return keys.map((key) => ({
    key,
    items: buckets
      .get(key)!
      .sort((a, b) => a.order - b.order || a.seq - b.seq)
      .map((x) => x.e),
  }));
}

/* ── Kết quả học tập ──────────────────────────────────────────────────────── */

export const GRADE_TYPE_ORDER: GradeSourceType[] = ['assignment', 'quiz', 'coding'];

export interface GradeGroupRow {
  id: string;
  title: string;
  maxScore: number;
  score: number | null;
}

export interface GradeGroup {
  type: GradeSourceType;
  rows: GradeGroupRow[];
  /** Số bài đã có điểm. */
  scored: number;
  /** Tổng điểm đạt trên các bài đã có điểm, và tổng điểm tối đa của CẢ nhóm. */
  earned: number;
  possible: number;
}

/** Gom sổ điểm theo loại bài; giữ thứ tự cột trong sổ và mọi con số điểm. */
export function groupGradebook(gradebook: StudentOwnGradebookDto | undefined): GradeGroup[] {
  if (!gradebook) return [];
  return GRADE_TYPE_ORDER.map((type) => {
    const rows = gradebook.items
      .filter((i) => i.sourceType === type)
      .map((i) => {
        const raw = gradebook.grades[i.id];
        return { id: i.id, title: i.title, maxScore: i.maxScore, score: raw ?? null };
      });
    const scoredRows = rows.filter((r) => r.score !== null);
    return {
      type,
      rows,
      scored: scoredRows.length,
      earned: round1(scoredRows.reduce((s, r) => s + (r.score ?? 0), 0)),
      possible: round1(rows.reduce((s, r) => s + r.maxScore, 0)),
    };
  }).filter((g) => g.rows.length > 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
