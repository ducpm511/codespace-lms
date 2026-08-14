import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import {
  CHOICE_QUESTION_TYPES,
  type Paginated,
  type QuizAuthorDetail,
  type QuizSummary,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateQuizDto } from './dto/create-quiz.dto';
import type { UpdateQuizDto } from './dto/update-quiz.dto';
import type { UpsertQuestionDto } from './dto/upsert-question.dto';

const withQuestions = {
  questions: {
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;
type QuizWithQuestions = Prisma.QuizGetPayload<{ include: typeof withQuestions }>;

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Authoring (GV/admin) ---

  async list(courseId: string | undefined, page: number, pageSize: number): Promise<Paginated<QuizSummary>> {
    const where = courseId ? { courseId } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quiz.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { questions: { select: { points: true } } },
      }),
      this.prisma.quiz.count({ where }),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  async create(dto: CreateQuizDto, createdById: string): Promise<QuizAuthorDetail> {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { id: true } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }
    if (dto.lessonId) {
      await this.ensureLessonInCourse(dto.lessonId, dto.courseId);
    }
    const created = await this.prisma.quiz.create({
      data: {
        courseId: dto.courseId,
        lessonId: dto.lessonId,
        title: dto.title,
        timeLimitSec: dto.timeLimitSec ?? null,
        attemptsAllowed: dto.attemptsAllowed,
        passScore: dto.passScore,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
        createdById,
      },
      include: withQuestions,
    });
    return toAuthorDetail(created);
  }

  /** Chi tiết cho GV/admin — CÓ isCorrect + correctAnswer. Route đã chặn bằng quiz.read. */
  async getAuthorDetail(id: string): Promise<QuizAuthorDetail> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: withQuestions });
    if (!quiz) {
      throw new NotFoundException('Quiz không tồn tại');
    }
    return toAuthorDetail(quiz);
  }

  async update(id: string, dto: UpdateQuizDto): Promise<QuizAuthorDetail> {
    await this.ensureQuiz(id);
    await this.prisma.quiz.update({
      where: { id },
      data: {
        title: dto.title,
        timeLimitSec: dto.timeLimitSec,
        attemptsAllowed: dto.attemptsAllowed,
        passScore: dto.passScore,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
      },
    });
    return this.getAuthorDetail(id);
  }

  async remove(id: string): Promise<void> {
    await this.ensureQuiz(id);
    await this.prisma.quiz.delete({ where: { id } });
  }

  /**
   * Tạo/sửa 1 câu hỏi + đáp án của nó (replace toàn bộ options). Choice-based cần options + isCorrect;
   * short_answer/code_fill dùng correctAnswer (không options). IDOR: câu hỏi phải thuộc đúng quiz.
   */
  async upsertQuestion(quizId: string, dto: UpsertQuestionDto): Promise<QuizAuthorDetail> {
    await this.ensureQuiz(quizId);
    validateQuestionPayload(dto);
    const isChoice = CHOICE_QUESTION_TYPES.includes(dto.type);
    const options = isChoice ? dto.options ?? [] : [];

    if (dto.id) {
      const existing = await this.prisma.question.findUnique({
        where: { id: dto.id },
        select: { quizId: true },
      });
      if (!existing || existing.quizId !== quizId) {
        throw new NotFoundException('Câu hỏi không thuộc quiz này');
      }
      await this.runCatchingOrder(dto.order, () =>
        this.prisma.$transaction(async (tx) => {
          await tx.question.update({
            where: { id: dto.id },
            data: {
              type: dto.type,
              promptMd: dto.promptMd,
              points: dto.points,
              order: dto.order,
              correctAnswer: isChoice ? null : dto.correctAnswer ?? null,
            },
          });
          await tx.questionOption.deleteMany({ where: { questionId: dto.id } });
          if (options.length > 0) {
            await tx.questionOption.createMany({
              data: options.map((o, i) => ({
                questionId: dto.id as string,
                textMd: o.textMd,
                isCorrect: o.isCorrect,
                order: o.order ?? i,
              })),
            });
          }
        }),
      );
    } else {
      const order = dto.order ?? (await this.nextQuestionOrder(quizId));
      await this.runCatchingOrder(order, () =>
        this.prisma.$transaction(async (tx) => {
          const q = await tx.question.create({
            data: {
              quizId,
              type: dto.type,
              promptMd: dto.promptMd,
              points: dto.points,
              order,
              correctAnswer: isChoice ? null : dto.correctAnswer ?? null,
            },
          });
          if (options.length > 0) {
            await tx.questionOption.createMany({
              data: options.map((o, i) => ({
                questionId: q.id,
                textMd: o.textMd,
                isCorrect: o.isCorrect,
                order: o.order ?? i,
              })),
            });
          }
        }),
      );
    }
    return this.getAuthorDetail(quizId);
  }

  async removeQuestion(quizId: string, questionId: string): Promise<QuizAuthorDetail> {
    await this.ensureQuiz(quizId);
    const q = await this.prisma.question.findUnique({ where: { id: questionId }, select: { quizId: true } });
    if (!q || q.quizId !== quizId) {
      throw new NotFoundException('Câu hỏi không thuộc quiz này');
    }
    await this.prisma.question.delete({ where: { id: questionId } });
    return this.getAuthorDetail(quizId);
  }

  // --- helpers ---

  private async ensureQuiz(id: string): Promise<void> {
    const q = await this.prisma.quiz.findUnique({ where: { id }, select: { id: true } });
    if (!q) {
      throw new NotFoundException('Quiz không tồn tại');
    }
  }

  private async ensureLessonInCourse(lessonId: string, courseId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
    if (!lesson || lesson.section.courseId !== courseId) {
      throw new BadRequestException('Bài học không thuộc khóa học này');
    }
  }

  private async nextQuestionOrder(quizId: string): Promise<number> {
    const agg = await this.prisma.question.aggregate({ where: { quizId }, _max: { order: true } });
    return (agg._max.order ?? -1) + 1;
  }

  private async runCatchingOrder<T>(order: number | undefined, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Thứ tự câu hỏi đã tồn tại: ${order}`);
      }
      throw e;
    }
  }
}

/** Validate payload câu hỏi theo loại (choice cần options + isCorrect; single/true_false đúng 1 đáp án). */
function validateQuestionPayload(dto: UpsertQuestionDto): void {
  if (CHOICE_QUESTION_TYPES.includes(dto.type)) {
    const opts = dto.options ?? [];
    if (opts.length < 2) {
      throw new BadRequestException('Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn');
    }
    const correct = opts.filter((o) => o.isCorrect).length;
    if (correct < 1) {
      throw new BadRequestException('Câu hỏi trắc nghiệm cần ít nhất 1 đáp án đúng');
    }
    if ((dto.type === 'single_choice' || dto.type === 'true_false') && correct !== 1) {
      throw new BadRequestException('Câu hỏi 1 đáp án chỉ được đánh dấu đúng 1 lựa chọn');
    }
  }
}

// --- mappers ---

function toSummary(q: {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  timeLimitSec: number | null;
  attemptsAllowed: number;
  passScore: unknown;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  createdAt: Date;
  questions: { points: unknown }[];
}): QuizSummary {
  const maxScore = q.questions.reduce((sum, x) => sum + Number(x.points), 0);
  return {
    id: q.id,
    courseId: q.courseId,
    lessonId: q.lessonId,
    title: q.title,
    timeLimitSec: q.timeLimitSec,
    attemptsAllowed: q.attemptsAllowed,
    passScore: Number(q.passScore),
    shuffleQuestions: q.shuffleQuestions,
    shuffleOptions: q.shuffleOptions,
    questionCount: q.questions.length,
    maxScore: Math.round(maxScore * 100) / 100,
    createdAt: q.createdAt.toISOString(),
  };
}

/** GV/admin: đầy đủ câu hỏi + đáp án đúng (isCorrect + correctAnswer). KHÔNG dùng cho student. */
function toAuthorDetail(q: QuizWithQuestions): QuizAuthorDetail {
  return {
    ...toSummary(q),
    questions: q.questions.map((qn) => ({
      id: qn.id,
      type: qn.type,
      promptMd: qn.promptMd,
      points: Number(qn.points),
      order: qn.order,
      correctAnswer: qn.correctAnswer,
      options: qn.options.map((o) => ({
        id: o.id,
        textMd: o.textMd,
        isCorrect: o.isCorrect,
        order: o.order,
      })),
    })),
  };
}
