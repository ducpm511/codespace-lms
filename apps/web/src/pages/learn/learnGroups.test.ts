import { describe, expect, it } from 'vitest';
import type { MyLessonDto, StudentOwnGradebookDto } from '@lms/contracts';
import {
  GENERAL_GROUP,
  filterExercises,
  groupExercisesByChapter,
  groupGradebook,
  isExerciseDone,
  quizScoresFrom,
  type Exercise,
} from './learnGroups';

const lesson = (lessonId: string, sectionTitle: string) =>
  ({ lessonId, sectionTitle, title: lessonId, type: 'article', courseTitle: 'C', progressStatus: 'not_started', activities: [] }) as MyLessonDto;

const lessons = [lesson('l1', 'Chương 1'), lesson('l2', 'Chương 1'), lesson('l3', 'Chương 2')];

const quiz = (id: string, lessonId: string | null): Exercise => ({ kind: 'quiz', id, title: id, lessonId, questionCount: 2, maxScore: 10 });
const coding = (id: string, lessonId: string | null, passed: boolean | null): Exercise => ({
  kind: 'coding', id, title: id, lessonId, difficulty: 'easy', maxScore: 100,
  myStatus: passed === null ? null : { attempts: 1, passed, bestScore: passed ? 100 : 40, latestStatus: passed ? 'passed' : 'failed' },
});

const gradebook: StudentOwnGradebookDto = {
  classId: 'c',
  items: [
    { id: 'g1', classId: 'c', sourceType: 'quiz', sourceId: 'q1', title: 'Quiz 1', weight: 1, maxScore: 10 },
    { id: 'quiz:q2', classId: 'c', sourceType: 'quiz', sourceId: 'q2', title: 'Quiz 2', weight: 1, maxScore: 10 },
    { id: 'g3', classId: 'c', sourceType: 'coding', sourceId: 'p1', title: 'Code 1', weight: 1, maxScore: 100 },
    { id: 'g4', classId: 'c', sourceType: 'assignment', sourceId: 'a1', title: 'Dự án', weight: 1, maxScore: 100 },
  ],
  grades: { g1: 8, 'quiz:q2': null, g3: 100, g4: 0 },
  totalWeightedScore: 70,
  completionRate: 75,
};

describe('trạng thái bài tập', () => {
  const scores = quizScoresFrom(gradebook);

  it('quiz xong khi sổ điểm có điểm, kể cả bài chưa có cột lưu (id tạm)', () => {
    expect(scores.get('q1')).toBe(8);
    expect(scores.has('q2')).toBe(false);
    expect(isExerciseDone(quiz('q1', 'l1'), scores)).toBe(true);
    expect(isExerciseDone(quiz('q2', 'l1'), scores)).toBe(false);
  });

  it('lập trình nộp mà chưa đạt vẫn là cần làm', () => {
    expect(isExerciseDone(coding('p1', 'l1', true), scores)).toBe(true);
    expect(isExerciseDone(coding('p2', 'l1', false), scores)).toBe(false);
    expect(isExerciseDone(coding('p3', 'l1', null), scores)).toBe(false);
  });

  it('lọc theo loại và trạng thái', () => {
    const all = [quiz('q1', 'l1'), quiz('q2', 'l1'), coding('p1', 'l1', true), coding('p2', 'l3', false)];
    expect(filterExercises(all, 'all', 'todo', scores).map((e) => e.id)).toEqual(['q2', 'p2']);
    expect(filterExercises(all, 'coding', 'done', scores).map((e) => e.id)).toEqual(['p1']);
    expect(filterExercises(all, 'quiz', 'all', scores)).toHaveLength(2);
  });
});

describe('groupExercisesByChapter', () => {
  it('theo thứ tự bài học của khóa, bài không gắn bài học mở dồn về cuối', () => {
    const groups = groupExercisesByChapter(
      [coding('p9', null, null), quiz('q3', 'l3'), quiz('q2', 'l2'), quiz('q1', 'l1'), quiz('qx', 'closed')],
      lessons,
    );
    expect(groups.map((g) => g.key)).toEqual(['Chương 1', 'Chương 2', GENERAL_GROUP]);
    expect(groups[0].items.map((e) => e.id)).toEqual(['q1', 'q2']);
    expect(groups[2].items.map((e) => e.id)).toEqual(['p9', 'qx']);
  });

  it('bỏ chương không còn bài nào sau khi lọc', () => {
    expect(groupExercisesByChapter([quiz('q3', 'l3')], lessons).map((g) => g.key)).toEqual(['Chương 2']);
  });
});

describe('groupGradebook', () => {
  it('nhóm theo loại, giữ mọi điểm, 0 điểm vẫn tính là đã có điểm', () => {
    const groups = groupGradebook(gradebook);
    expect(groups.map((g) => g.type)).toEqual(['assignment', 'quiz', 'coding']);
    const q = groups.find((g) => g.type === 'quiz')!;
    expect(q.rows.map((r) => r.score)).toEqual([8, null]);
    expect(q).toMatchObject({ scored: 1, earned: 8, possible: 20 });
    expect(groups.find((g) => g.type === 'assignment')).toMatchObject({ scored: 1, earned: 0, possible: 100 });
  });

  it('sổ rỗng thì không có nhóm', () => {
    expect(groupGradebook(undefined)).toEqual([]);
    expect(groupGradebook({ ...gradebook, items: [] })).toEqual([]);
  });
});
