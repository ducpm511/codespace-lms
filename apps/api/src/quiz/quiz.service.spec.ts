import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';
import type { AuthPrincipal } from '../auth/auth.types';

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
    classMember: { findUnique: jest.fn() },
    classCourse: { findUnique: jest.fn(), findMany: jest.fn() },
    lessonGate: { findUnique: jest.fn(), findMany: jest.fn() },
    quizAttempt: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    quizAnswer: { create: jest.fn() },
    lessonProgress: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  // Hỗ trợ cả 2 dạng: $transaction([...]) và $transaction(async (tx) => ...).
  p.$transaction.mockImplementation((arg) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(p),
  );
  return p;
}

function makeRbac() {
  return {
    getEffectivePermissions: jest.fn().mockResolvedValue([]),
    hasPermission: jest.fn().mockReturnValue(false),
  };
}

const principal = (userId: string): AuthPrincipal => ({ userId }) as AuthPrincipal;

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
  let rbac: ReturnType<typeof makeRbac>;
  let service: QuizService;

  beforeEach(() => {
    prisma = makePrisma();
    rbac = makeRbac();
    service = new QuizService(prisma as unknown as PrismaService, rbac as unknown as RbacService);
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

  // Quiz có đáp án (author view) để test surface student + chấm điểm.
  function gradableQuiz(over: Record<string, unknown> = {}) {
    return {
      id: 'q1',
      courseId: 'c1',
      lessonId: null,
      title: 'T',
      timeLimitSec: null,
      attemptsAllowed: 2,
      passScore: '0',
      shuffleQuestions: false,
      shuffleOptions: false,
      createdAt: now,
      questions: [
        {
          id: 'qn1', type: 'single_choice', promptMd: '2+2?', points: '2', order: 0, correctAnswer: null,
          options: [
            { id: 'o1', textMd: '3', isCorrect: false, order: 0 },
            { id: 'o2', textMd: '4', isCorrect: true, order: 1 },
          ],
        },
        {
          id: 'qn2', type: 'short_answer', promptMd: 'Thủ đô VN?', points: '3', order: 1,
          correctAnswer: 'Hà Nội', options: [],
        },
      ],
      ...over,
    };
  }

  describe('getStudentDetail (INVARIANT: không lộ isCorrect/correctAnswer)', () => {
    it('chỉ trả prompt + options text; không isCorrect, không correctAnswer', async () => {
      prisma.quiz.findUnique.mockResolvedValue(gradableQuiz());
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      const res = await service.getStudentDetail('q1', 'class-1', 'stu-1');
      const flat = JSON.stringify(res);
      expect(flat).not.toContain('isCorrect');
      expect(flat).not.toContain('correctAnswer');
      expect(flat).not.toContain('Hà Nội');
      expect(res.questions[0].options).toHaveLength(2);
      expect(res.questions[1].options).toHaveLength(0); // short_answer không options
    });

    it('403 khi không phải thành viên', async () => {
      prisma.quiz.findUnique.mockResolvedValue(gradableQuiz());
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(service.getStudentDetail('q1', 'class-1', 'stu-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('submitAttempt (chấm server-side, weighted Decimal)', () => {
    const okMembership = () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
    };

    it('chấm đúng: single_choice đúng + short_answer normalized-match → score = Σ points', async () => {
      prisma.quiz.findUnique.mockResolvedValue(gradableQuiz());
      okMembership();
      prisma.quizAttempt.count.mockResolvedValue(0);
      prisma.quizAttempt.create.mockResolvedValue({ id: 'att1' });
      prisma.quizAttempt.findUnique.mockResolvedValue({
        id: 'att1', quizId: 'q1', userId: 'stu-1', classId: 'class-1', status: 'submitted',
        score: '5', startedAt: now, submittedAt: now,
        quiz: { questions: [{ points: '2' }, { points: '3' }] },
        answers: [
          { questionId: 'qn1', selectedOptionIds: ['o2'], textAnswer: null, awardedPoints: '2', isCorrect: true },
          { questionId: 'qn2', selectedOptionIds: null, textAnswer: 'hà nội', awardedPoints: '3', isCorrect: true },
        ],
      });

      const res = await service.submitAttempt('q1', 'stu-1', {
        classId: 'class-1',
        answers: [
          { questionId: 'qn1', selectedOptionIds: ['o2'] },
          { questionId: 'qn2', textAnswer: '  Hà   Nội ' }, // khác hoa/khoảng trắng vẫn đúng
        ],
      });

      const createArg = prisma.quizAttempt.create.mock.calls[0][0];
      expect(Number(createArg.data.score)).toBe(5);
      expect(createArg.data.status).toBe('submitted');
      expect(prisma.quizAnswer.create).toHaveBeenCalledTimes(2);
      expect(res.score).toBe(5);
      expect(res.maxScore).toBe(5);
    });

    it('câu sai → 0 điểm cho câu đó', async () => {
      prisma.quiz.findUnique.mockResolvedValue(gradableQuiz());
      okMembership();
      prisma.quizAttempt.count.mockResolvedValue(0);
      prisma.quizAttempt.create.mockResolvedValue({ id: 'att2' });
      prisma.quizAttempt.findUnique.mockResolvedValue({
        id: 'att2', quizId: 'q1', userId: 'stu-1', classId: 'class-1', status: 'submitted',
        score: '2', startedAt: now, submittedAt: now,
        quiz: { questions: [{ points: '2' }, { points: '3' }] }, answers: [],
      });
      await service.submitAttempt('q1', 'stu-1', {
        classId: 'class-1',
        answers: [
          { questionId: 'qn1', selectedOptionIds: ['o1'] }, // sai
          { questionId: 'qn2', textAnswer: 'Sài Gòn' }, // sai
        ],
      });
      const createArg = prisma.quizAttempt.create.mock.calls[0][0];
      expect(Number(createArg.data.score)).toBe(0);
    });

    it('403 khi hết lượt (attemptsAllowed)', async () => {
      prisma.quiz.findUnique.mockResolvedValue(gradableQuiz({ attemptsAllowed: 1 }));
      okMembership();
      prisma.quizAttempt.count.mockResolvedValue(1);
      await expect(
        service.submitAttempt('q1', 'stu-1', { classId: 'class-1', answers: [] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('403 khi không phải thành viên (không tạo attempt)', async () => {
      prisma.quiz.findUnique.mockResolvedValue(gradableQuiz());
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(
        service.submitAttempt('q1', 'stu-1', { classId: 'class-1', answers: [] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('getAttempt (ownership + scope)', () => {
    const attemptRow = {
      id: 'att1', quizId: 'q1', userId: 'stu-1', classId: 'class-1', status: 'submitted',
      score: '2', startedAt: now, submittedAt: now,
      quiz: { questions: [{ points: '2' }] },
      answers: [{ questionId: 'qn1', selectedOptionIds: ['o2'], textAnswer: null, awardedPoints: '2', isCorrect: true }],
    };

    it('chủ sở hữu xem được, không cần permission', async () => {
      prisma.quizAttempt.findUnique.mockResolvedValue(attemptRow);
      const res = await service.getAttempt('att1', principal('stu-1'));
      expect(res.id).toBe('att1');
      expect(rbac.hasPermission).not.toHaveBeenCalled();
    });

    it('người khác không có quiz.result.read theo lớp → 403', async () => {
      prisma.quizAttempt.findUnique.mockResolvedValue(attemptRow);
      rbac.hasPermission.mockReturnValue(false);
      await expect(service.getAttempt('att1', principal('gv-x'))).rejects.toBeInstanceOf(ForbiddenException);
      expect(rbac.hasPermission).toHaveBeenCalledWith(expect.anything(), 'quiz.result.read', 'class-1');
    });
  });

  describe('listForClass', () => {
    it('403 khi không phải thành viên', async () => {
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(service.listForClass('class-1', 'stu-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.quiz.findMany).not.toHaveBeenCalled();
    });

    it('chỉ trả quiz no-lesson HOẶC lesson gated', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findMany.mockResolvedValue([{ courseId: 'c1' }]);
      prisma.quiz.findMany.mockResolvedValue([
        quizRow({ id: 'free', lessonId: null }),
        quizRow({ id: 'gated-open', lessonId: 'l-open' }),
        quizRow({ id: 'gated-closed', lessonId: 'l-closed' }),
      ]);
      prisma.lessonGate.findMany.mockResolvedValue([{ lessonId: 'l-open' }]);
      const res = await service.listForClass('class-1', 'stu-1');
      expect(res.map((q) => q.id).sort()).toEqual(['free', 'gated-open']);
    });
  });
});
