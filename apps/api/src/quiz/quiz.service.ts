import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import {
  CHOICE_QUESTION_TYPES,
  PERMISSIONS,
  type Paginated,
  type QuizAttemptDto,
  type QuizAuthorDetail,
  type QuizStudentDetail,
  type QuizSummary,
} from '@lms/contracts';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import type { CreateQuizDto } from './dto/create-quiz.dto';
import type { UpdateQuizDto } from './dto/update-quiz.dto';
import type { UpsertQuestionDto } from './dto/upsert-question.dto';
import type { SubmitAttemptDto } from './dto/submit-attempt.dto';

const withQuestions = {
  questions: {
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;
type QuizWithQuestions = Prisma.QuizGetPayload<{ include: typeof withQuestions }>;

const withAttemptDetail = {
  quiz: { select: { questions: { select: { points: true } } } },
  answers: true,
} satisfies Prisma.QuizAttemptInclude;
type AttemptWithDetail = Prisma.QuizAttemptGetPayload<{ include: typeof withAttemptDetail }>;

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

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

  // --- Student (làm bài) — KHÔNG isCorrect/correctAnswer ---

  /**
   * Danh sách quiz học viên trong lớp có thể làm: thuộc khóa đã gán lớp và (không gắn lesson HOẶC
   * lesson đã mở gate). Chỉ summary — KHÔNG đáp án. Không @RequirePermission (membership kiểm ở đây).
   */
  async listForClass(classId: string, userId: string): Promise<QuizSummary[]> {
    await this.ensureActiveMember(classId, userId);
    const classCourses = await this.prisma.classCourse.findMany({
      where: { classId },
      select: { courseId: true },
    });
    const courseIds = classCourses.map((c) => c.courseId);
    if (courseIds.length === 0) {
      return [];
    }
    const [quizzes, gates] = await this.prisma.$transaction([
      this.prisma.quiz.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: { createdAt: 'desc' },
        include: { questions: { select: { points: true } } },
      }),
      this.prisma.lessonGate.findMany({ where: { classId, isActive: true }, select: { lessonId: true } }),
    ]);
    const openLessons = new Set(gates.map((g) => g.lessonId));
    return quizzes.filter((q) => q.lessonId === null || openLessons.has(q.lessonId)).map(toSummary);
  }

  /**
   * Đề quiz cho học viên trong một lớp: membership + khóa thuộc lớp + gate. INVARIANT: chỉ trả prompt +
   * options text; KHÔNG isCorrect, KHÔNG correctAnswer.
   */
  async getStudentDetail(id: string, classId: string, userId: string): Promise<QuizStudentDetail> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: withQuestions });
    if (!quiz) {
      throw new NotFoundException('Quiz không tồn tại');
    }
    await this.ensureActiveMember(classId, userId);
    await this.ensureCourseInClass(classId, quiz.courseId);
    if (quiz.lessonId) {
      await this.ensureLessonGateActive(classId, quiz.lessonId);
    }
    return toStudentDetail(quiz);
  }

  /**
   * Nộp bài + CHẤM server-side trong một lần (tránh dangling attempt): kiểm membership + gate +
   * attemptsAllowed, chấm lại toàn bộ (KHÔNG tin client), lưu QuizAnswer + attempt + LessonProgress
   * trong CÙNG transaction. Điểm là Decimal weighted theo Question.points.
   */
  async submitAttempt(quizId: string, userId: string, dto: SubmitAttemptDto): Promise<QuizAttemptDto> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz không tồn tại');
    }
    await this.ensureActiveMember(dto.classId, userId);
    await this.ensureCourseInClass(dto.classId, quiz.courseId);
    if (quiz.lessonId) {
      await this.ensureLessonGateActive(dto.classId, quiz.lessonId);
    }

    const used = await this.prisma.quizAttempt.count({
      where: { quizId, userId, classId: dto.classId },
    });
    if (used >= quiz.attemptsAllowed) {
      throw new ForbiddenException('Bạn đã hết lượt làm quiz này');
    }

    const answersByQ = new Map(dto.answers.map((a) => [a.questionId, a]));
    const outcomes = quiz.questions.map((qn) => gradeQuestion(qn, answersByQ.get(qn.id)));
    const score = outcomes
      .reduce((s, o) => s.add(o.awardedPoints), new Prisma.Decimal(0))
      .toDecimalPlaces(2);
    const passed = score.gte(quiz.passScore);

    const created = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          quizId,
          userId,
          classId: dto.classId,
          status: 'submitted',
          score,
          submittedAt: new Date(),
        },
        select: { id: true },
      });
      for (const o of outcomes) {
        await tx.quizAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: o.questionId,
            selectedOptionIds: o.selectedOptionIds ?? Prisma.DbNull,
            textAnswer: o.textAnswer,
            awardedPoints: o.awardedPoints,
            isCorrect: o.isCorrect,
          },
        });
      }
      if (quiz.lessonId) {
        await this.reflectLessonProgress(tx, userId, quiz.lessonId, dto.classId, passed);
      }
      return attempt;
    });

    return this.getAttemptById(created.id);
  }

  /**
   * Xem 1 attempt: chủ sở hữu, hoặc GV/TA có quiz.result.read theo lớp của attempt. Route không có
   * :classId nên scope kiểm ở đây theo attempt.classId (giống coding.getSubmission).
   */
  async getAttempt(id: string, currentUser: AuthPrincipal): Promise<QuizAttemptDto> {
    const attempt = await this.loadAttempt(id);
    if (attempt.userId !== currentUser.userId) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.userId);
      if (!this.rbac.hasPermission(eff, PERMISSIONS.QUIZ_RESULT_READ, attempt.classId ?? undefined)) {
        throw new ForbiddenException('Không có quyền xem bài làm này');
      }
    }
    return toAttemptDto(attempt);
  }

  private async getAttemptById(id: string): Promise<QuizAttemptDto> {
    return toAttemptDto(await this.loadAttempt(id));
  }

  private async loadAttempt(id: string): Promise<AttemptWithDetail> {
    const attempt = await this.prisma.quizAttempt.findUnique({ where: { id }, include: withAttemptDetail });
    if (!attempt) {
      throw new NotFoundException('Bài làm không tồn tại');
    }
    return attempt;
  }

  /** LessonProgress: đạt → completed (không hạ cấp bài đã completed); chưa đạt → in_progress nếu chưa có. */
  private async reflectLessonProgress(
    tx: Prisma.TransactionClient,
    userId: string,
    lessonId: string,
    classId: string,
    passed: boolean,
  ): Promise<void> {
    const key = { userId_lessonId_classId: { userId, lessonId, classId } };
    if (passed) {
      await tx.lessonProgress.upsert({
        where: key,
        create: { userId, lessonId, classId, status: 'completed', completedAt: new Date() },
        update: { status: 'completed', completedAt: new Date() },
      });
    } else {
      const existing = await tx.lessonProgress.findUnique({ where: key, select: { status: true } });
      if (!existing) {
        await tx.lessonProgress.create({ data: { userId, lessonId, classId, status: 'in_progress' } });
      } else if (existing.status === 'not_started') {
        await tx.lessonProgress.update({ where: key, data: { status: 'in_progress' } });
      }
    }
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

  private async ensureActiveMember(classId: string, userId: string): Promise<void> {
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không thuộc lớp này');
    }
  }

  private async ensureCourseInClass(classId: string, courseId: string): Promise<void> {
    const cc = await this.prisma.classCourse.findUnique({
      where: { classId_courseId: { classId, courseId } },
      select: { id: true },
    });
    if (!cc) {
      throw new BadRequestException('Quiz không thuộc khóa học của lớp này');
    }
  }

  private async ensureLessonGateActive(classId: string, lessonId: string): Promise<void> {
    const gate = await this.prisma.lessonGate.findUnique({
      where: { classId_lessonId: { classId, lessonId } },
      select: { isActive: true },
    });
    if (!gate || !gate.isActive) {
      throw new ForbiddenException('Bài học chưa được mở cho lớp này');
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

/**
 * Student: prompt + options text only. KHÔNG isCorrect, KHÔNG correctAnswer.
 * Ranh giới bảo mật P4 — đừng thêm đáp án đúng vào đây.
 */
function toStudentDetail(q: QuizWithQuestions): QuizStudentDetail {
  return {
    ...toSummary(q),
    questions: q.questions.map((qn) => ({
      id: qn.id,
      type: qn.type,
      promptMd: qn.promptMd,
      points: Number(qn.points),
      order: qn.order,
      options: qn.options.map((o) => ({ id: o.id, textMd: o.textMd, order: o.order })),
    })),
  };
}

function toAttemptDto(a: AttemptWithDetail): QuizAttemptDto {
  const maxScore = a.quiz.questions.reduce((s, x) => s + Number(x.points), 0);
  return {
    id: a.id,
    quizId: a.quizId,
    userId: a.userId,
    classId: a.classId,
    status: a.status,
    score: a.score != null ? Number(a.score) : null,
    maxScore: Math.round(maxScore * 100) / 100,
    startedAt: a.startedAt.toISOString(),
    submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
    answers: a.answers.map((ans) => ({
      questionId: ans.questionId,
      selectedOptionIds: (ans.selectedOptionIds as string[] | null) ?? null,
      textAnswer: ans.textAnswer,
      awardedPoints: ans.awardedPoints != null ? Number(ans.awardedPoints) : 0,
      isCorrect: ans.isCorrect ?? false,
    })),
  };
}

// --- grading (server-authoritative; KHÔNG tin client) ---

type GradableQuestion = Prisma.QuestionGetPayload<{ include: { options: true } }>;
interface AnswerOutcome {
  questionId: string;
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  awardedPoints: Prisma.Decimal;
  isCorrect: boolean;
}

/** Chuẩn hóa text để so đáp án tự luận ngắn: trim + lowercase + gộp khoảng trắng. */
function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function gradeQuestion(q: GradableQuestion, ans: { selectedOptionIds?: string[]; textAnswer?: string } | undefined): AnswerOutcome {
  const isChoice = CHOICE_QUESTION_TYPES.includes(q.type);
  let isCorrect = false;
  let selectedOptionIds: string[] | null = null;
  let textAnswer: string | null = null;

  if (isChoice) {
    const optionIds = new Set(q.options.map((o) => o.id));
    // Chỉ giữ option hợp lệ thuộc câu hỏi (chống rác/injection từ client).
    const selected = [...new Set((ans?.selectedOptionIds ?? []).filter((id) => optionIds.has(id)))].sort();
    selectedOptionIds = selected;
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
    isCorrect = correctIds.length === selected.length && correctIds.every((id, i) => id === selected[i]);
  } else {
    textAnswer = ans?.textAnswer ?? null;
    if (q.correctAnswer != null && textAnswer != null) {
      isCorrect = normalizeText(textAnswer) === normalizeText(q.correctAnswer);
    }
  }

  return {
    questionId: q.id,
    selectedOptionIds,
    textAnswer,
    awardedPoints: isCorrect ? new Prisma.Decimal(q.points) : new Prisma.Decimal(0),
    isCorrect,
  };
}
