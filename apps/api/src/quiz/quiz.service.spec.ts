import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  const p = {
    quiz: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    questionOption: { deleteMany: jest.fn(), createMany: jest.fn() },
    course: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  // Hỗ trợ cả 2 dạng: $transaction([...]) và $transaction(async (tx) => ...).
  p.$transaction.mockImplementation((arg) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(p),
  );
  return p;
}

const now = new Date('2026-08-14T00:00:00.000Z');

function quizRow(over: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    courseId: 'c1',
    lessonId: null,
    title: 'Basics quiz',
    timeLimitSec: null,
    attemptsAllowed: 1,
    passScore: '50',
    shuffleQuestions: false,
    shuffleOptions: false,
    createdAt: now,
    questions: [
      {
        id: 'qn1',
        type: 'single_choice',
        promptMd: '2+2?',
        points: '2',
        order: 0,
        correctAnswer: null,
        options: [
          { id: 'o1', textMd: '3', isCorrect: false, order: 0 },
          { id: 'o2', textMd: '4', isCorrect: true, order: 1 }, // ĐÁP ÁN ĐÚNG
        ],
      },
    ],
    ...over,
  };
}

describe('QuizService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: QuizService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new QuizService(prisma as unknown as PrismaService);
  });

  describe('getAuthorDetail', () => {
    it('GV thấy isCorrect + correctAnswer; maxScore = Σ points', async () => {
      prisma.quiz.findUnique.mockResolvedValue(quizRow());
      const res = await service.getAuthorDetail('q1');
      expect(res.questions[0].options.find((o) => o.textMd === '4')?.isCorrect).toBe(true);
      expect(res.maxScore).toBe(2);
      expect(res.questionCount).toBe(1);
      expect(res.passScore).toBe(50);
    });

    it('404 khi không tồn tại', async () => {
      prisma.quiz.findUnique.mockResolvedValue(null);
      await expect(service.getAuthorDetail('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('404 khi course không tồn tại', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.create({ courseId: 'ghost', title: 'X' }, 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('400 khi lessonId không thuộc course', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.lesson.findUnique.mockResolvedValue({ section: { courseId: 'other' } });
      await expect(
        service.create({ courseId: 'c1', lessonId: 'l1', title: 'X' }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('upsertQuestion (validate loại câu hỏi + IDOR)', () => {
    beforeEach(() => {
      prisma.quiz.findUnique.mockResolvedValue({ id: 'q1' });
    });

    it('400 khi trắc nghiệm < 2 lựa chọn', async () => {
      await expect(
        service.upsertQuestion('q1', {
          type: 'single_choice',
          promptMd: 'x',
          options: [{ textMd: 'only', isCorrect: true }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 khi single_choice có 2 đáp án đúng', async () => {
      await expect(
        service.upsertQuestion('q1', {
          type: 'single_choice',
          promptMd: 'x',
          options: [
            { textMd: 'a', isCorrect: true },
            { textMd: 'b', isCorrect: true },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 khi trắc nghiệm không có đáp án đúng', async () => {
      await expect(
        service.upsertQuestion('q1', {
          type: 'multiple_choice',
          promptMd: 'x',
          options: [
            { textMd: 'a', isCorrect: false },
            { textMd: 'b', isCorrect: false },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('tạo câu multiple_choice hợp lệ → createMany options', async () => {
      prisma.question.aggregate.mockResolvedValue({ _max: { order: 0 } });
      prisma.question.create.mockResolvedValue({ id: 'qnNew' });
      prisma.quiz.findUnique
        .mockResolvedValueOnce({ id: 'q1' }) // ensureQuiz
        .mockResolvedValueOnce(quizRow()); // getAuthorDetail cuối
      await service.upsertQuestion('q1', {
        type: 'multiple_choice',
        promptMd: 'chọn số chẵn',
        options: [
          { textMd: '2', isCorrect: true },
          { textMd: '3', isCorrect: false },
          { textMd: '4', isCorrect: true },
        ],
      });
      expect(prisma.question.create).toHaveBeenCalled();
      expect(prisma.questionOption.createMany).toHaveBeenCalled();
    });

    it('404 khi sửa câu hỏi thuộc quiz khác (IDOR)', async () => {
      prisma.question.findUnique.mockResolvedValue({ quizId: 'other' });
      await expect(
        service.upsertQuestion('q1', {
          id: 'qnX',
          type: 'true_false',
          promptMd: 'x',
          options: [
            { textMd: 'Đúng', isCorrect: true },
            { textMd: 'Sai', isCorrect: false },
          ],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('short_answer: KHÔNG cần options, correctAnswer lưu (author-only)', async () => {
      prisma.question.aggregate.mockResolvedValue({ _max: { order: null } });
      prisma.question.create.mockResolvedValue({ id: 'qnSa' });
      prisma.quiz.findUnique.mockResolvedValueOnce({ id: 'q1' }).mockResolvedValueOnce(quizRow());
      await service.upsertQuestion('q1', {
        type: 'short_answer',
        promptMd: 'Thủ đô VN?',
        correctAnswer: 'Hà Nội',
      });
      expect(prisma.question.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ correctAnswer: 'Hà Nội' }) }),
      );
      expect(prisma.questionOption.createMany).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('trả summary với questionCount + maxScore', async () => {
      prisma.quiz.findMany.mockResolvedValue([quizRow()]);
      prisma.quiz.count.mockResolvedValue(1);
      const res = await service.list(undefined, 1, 20);
      expect(res.total).toBe(1);
      expect(res.items[0].questionCount).toBe(1);
      expect(res.items[0].maxScore).toBe(2);
    });
  });
});
