/** Lọc + nhóm danh sách bài lập trình theo cây khóa học. Thuần logic, không JSX (giống `adminUi.ts`). */
import type { CodingProblemSummary, SectionWithLessons } from '@lms/contracts';

/** Khóa nhóm cho bài chưa gắn bài học (hoặc gắn bài học không còn trong khóa). */
export const UNASSIGNED_CHAPTER = '__unassigned__';

export interface LessonGroup {
  /** null = bài nằm thẳng trong nhóm "chưa gắn bài học". */
  lessonId: string | null;
  lessonTitle: string | null;
  problems: CodingProblemSummary[];
}

export interface ChapterGroup {
  key: string;
  /** null = nhóm "chưa gắn bài học". */
  title: string | null;
  total: number;
  lessons: LessonGroup[];
}

export interface ProblemFilter {
  query: string;
  /** Rỗng = mọi độ khó. */
  difficulty: string;
}

/** Giáo viên gõ "vong lap" vẫn phải ra "Vòng lặp": bỏ dấu, hoa thường, và cả đ (NFD không tách được đ). */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Tìm khớp cả tên bài lẫn tên bài học/chương: gõ tên bài học là ra mọi bài tập của bài học đó. */
export function filterProblems(
  problems: CodingProblemSummary[],
  sections: SectionWithLessons[],
  filter: ProblemFilter,
): CodingProblemSummary[] {
  const query = normalizeSearch(filter.query);
  const contextByLesson = new Map<string, string>();
  for (const s of sections) {
    for (const l of s.lessons ?? []) {
      contextByLesson.set(l.id, `${s.title} ${l.title}`);
    }
  }
  return problems.filter((p) => {
    if (filter.difficulty && p.difficulty !== filter.difficulty) return false;
    if (!query) return true;
    const context = p.lessonId ? contextByLesson.get(p.lessonId) ?? '' : '';
    return normalizeSearch(`${p.title} ${context}`).includes(query);
  });
}

/**
 * Nhóm theo đúng thứ tự chương → bài học của khóa (API trả theo `order`), bỏ chương/bài học không có
 * bài tập. Trong một bài học xếp theo thứ tự tạo để bài mới luôn nằm cuối, không làm xáo vị trí bài cũ.
 */
export function groupProblems(problems: CodingProblemSummary[], sections: SectionWithLessons[]): ChapterGroup[] {
  const sorted = [...problems].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const byLesson = new Map<string, CodingProblemSummary[]>();
  for (const p of sorted) {
    if (!p.lessonId) continue;
    byLesson.set(p.lessonId, [...(byLesson.get(p.lessonId) ?? []), p]);
  }

  const known = new Set<string>();
  const chapters: ChapterGroup[] = [];
  for (const s of sections) {
    const lessons: LessonGroup[] = [];
    for (const l of s.lessons ?? []) {
      known.add(l.id);
      const items = byLesson.get(l.id);
      if (items) lessons.push({ lessonId: l.id, lessonTitle: l.title, problems: items });
    }
    if (lessons.length > 0) {
      chapters.push({
        key: s.id,
        title: s.title,
        total: lessons.reduce((sum, l) => sum + l.problems.length, 0),
        lessons,
      });
    }
  }

  const unassigned = sorted.filter((p) => !p.lessonId || !known.has(p.lessonId));
  if (unassigned.length > 0) {
    chapters.push({
      key: UNASSIGNED_CHAPTER,
      title: null,
      total: unassigned.length,
      lessons: [{ lessonId: null, lessonTitle: null, problems: unassigned }],
    });
  }
  return chapters;
}

/** Chương chứa một bài học — để mở sẵn đúng chương sau khi tạo bài mới. */
export function chapterKeyOfLesson(lessonId: string | null | undefined, sections: SectionWithLessons[]): string {
  const section = lessonId ? sections.find((s) => (s.lessons ?? []).some((l) => l.id === lessonId)) : undefined;
  return section?.id ?? UNASSIGNED_CHAPTER;
}
