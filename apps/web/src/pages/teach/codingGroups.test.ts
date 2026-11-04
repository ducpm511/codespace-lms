import { describe, expect, it } from 'vitest';
import type { CodingProblemSummary, SectionWithLessons } from '@lms/contracts';
import {
  UNASSIGNED_CHAPTER,
  chapterKeyOfLesson,
  filterProblems,
  groupProblems,
  normalizeSearch,
} from './codingGroups';

const sections = [
  {
    id: 's1',
    title: 'Chương 1: Nhập môn',
    order: 0,
    lessons: [
      { id: 'l1', title: 'Biến và kiểu dữ liệu', order: 0, type: 'article' },
      { id: 'l2', title: 'Đọc dữ liệu', order: 1, type: 'article' },
    ],
  },
  {
    id: 's2',
    title: 'Chương 2: Vòng lặp',
    order: 1,
    lessons: [{ id: 'l3', title: 'For và while', order: 0, type: 'article' }],
  },
  { id: 's3', title: 'Chương 3: Chưa có bài tập', order: 2, lessons: [] },
] as unknown as SectionWithLessons[];

function problem(id: string, title: string, lessonId: string | null, over: Partial<CodingProblemSummary> = {}) {
  return {
    id,
    courseId: 'c1',
    lessonId,
    title,
    language: 'python',
    difficulty: 'easy',
    maxScore: 100,
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    createdAt: `2026-11-01T00:00:0${id.length}.000Z`,
    ...over,
  } satisfies CodingProblemSummary;
}

describe('normalizeSearch', () => {
  it('bỏ dấu tiếng Việt, kể cả đ, và không phân biệt hoa thường', () => {
    expect(normalizeSearch('  Đọc Dữ Liệu ')).toBe('doc du lieu');
    expect(normalizeSearch('Vòng lặp')).toBe('vong lap');
  });
});

describe('filterProblems', () => {
  const all = [
    problem('a', 'Tổng hai số', 'l1'),
    problem('b', 'In bảng cửu chương', 'l3', { difficulty: 'hard' }),
    problem('c', 'Bài rời', null, { difficulty: 'medium' }),
  ];

  it('không lọc thì giữ nguyên', () => {
    expect(filterProblems(all, sections, { query: '', difficulty: '' })).toHaveLength(3);
  });

  it('tìm theo tên không cần gõ dấu', () => {
    const res = filterProblems(all, sections, { query: 'tong hai', difficulty: '' });
    expect(res.map((p) => p.id)).toEqual(['a']);
  });

  it('tìm theo tên bài học hoặc chương cũng ra bài tập bên trong', () => {
    expect(filterProblems(all, sections, { query: 'vong lap', difficulty: '' }).map((p) => p.id)).toEqual(['b']);
    expect(filterProblems(all, sections, { query: 'kieu du lieu', difficulty: '' }).map((p) => p.id)).toEqual(['a']);
  });

  it('kết hợp tìm kiếm với độ khó', () => {
    expect(filterProblems(all, sections, { query: '', difficulty: 'hard' }).map((p) => p.id)).toEqual(['b']);
    expect(filterProblems(all, sections, { query: 'tong', difficulty: 'hard' })).toEqual([]);
  });
});

describe('groupProblems', () => {
  it('theo thứ tự chương → bài học của khóa, bỏ chương trống, nhóm chưa gắn nằm cuối', () => {
    const groups = groupProblems(
      [problem('z', 'Rời', null), problem('b', 'Lặp', 'l3'), problem('a', 'Biến', 'l1'), problem('c', 'Đọc', 'l2')],
      sections,
    );
    expect(groups.map((g) => g.key)).toEqual(['s1', 's2', UNASSIGNED_CHAPTER]);
    expect(groups[0].total).toBe(2);
    expect(groups[0].lessons.map((l) => l.lessonId)).toEqual(['l1', 'l2']);
    expect(groups[2].title).toBeNull();
  });

  it('trong một bài học: bài tạo trước đứng trước', () => {
    const groups = groupProblems(
      [
        problem('moi', 'Mới', 'l1', { createdAt: '2026-11-02T00:00:00.000Z' }),
        problem('cu', 'Cũ', 'l1', { createdAt: '2026-11-01T00:00:00.000Z' }),
      ],
      sections,
    );
    expect(groups[0].lessons[0].problems.map((p) => p.id)).toEqual(['cu', 'moi']);
  });

  it('bài gắn bài học không còn trong khóa không bị mất, rơi về nhóm chưa gắn', () => {
    const groups = groupProblems([problem('x', 'Mồ côi', 'l-da-xoa')], sections);
    expect(groups.map((g) => g.key)).toEqual([UNASSIGNED_CHAPTER]);
    expect(groups[0].lessons[0].problems.map((p) => p.id)).toEqual(['x']);
  });
});

describe('chapterKeyOfLesson', () => {
  it('trả đúng chương, hoặc nhóm chưa gắn', () => {
    expect(chapterKeyOfLesson('l3', sections)).toBe('s2');
    expect(chapterKeyOfLesson(null, sections)).toBe(UNASSIGNED_CHAPTER);
    expect(chapterKeyOfLesson('khong-co', sections)).toBe(UNASSIGNED_CHAPTER);
  });
});
