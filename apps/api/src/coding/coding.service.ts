import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import {
  PERMISSIONS,
  type CodingProblemAuthorDetail,
  type CodingProblemStudentDetail,
  type CodingProblemSummary,
  type CodingSubmissionDto,
  type Paginated,
} from '@lms/contracts';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { SubmissionQueue } from './queue/submission-queue';
import type { CreateCodingProblemDto } from './dto/create-coding-problem.dto';
import type { UpdateCodingProblemDto } from './dto/update-coding-problem.dto';
import type { UpsertTestCaseDto } from './dto/upsert-test-case.dto';
import type { SubmitCodingSubmissionDto } from './dto/submit-coding-submission.dto';

const withTestCases = {
  testCases: { orderBy: { order: 'asc' } },
} satisfies Prisma.CodingProblemInclude;
type ProblemWithTests = Prisma.CodingProblemGetPayload<{ include: typeof withTestCases }>;

const withResults = {
  results: { include: { testCase: { select: { name: true, order: true } } } },
} satisfies Prisma.CodingSubmissionInclude;
type SubmissionWithResults = Prisma.CodingSubmissionGetPayload<{ include: typeof withResults }>;

@Injectable()
export class CodingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly queue: SubmissionQueue,
  ) {}

  // --- Authoring (GV/admin) ---

  async list(courseId: string | undefined, page: number, pageSize: number): Promise<Paginated<CodingProblemSummary>> {
    const where = courseId ? { courseId } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.codingProblem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.codingProblem.count({ where }),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  async create(dto: CreateCodingProblemDto, createdById: string): Promise<CodingProblemAuthorDetail> {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { id: true } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }
    if (dto.lessonId) {
      await this.ensureLessonInCourse(dto.lessonId, dto.courseId);
    }
    const created = await this.prisma.codingProblem.create({
      data: {
        courseId: dto.courseId,
        lessonId: dto.lessonId,
        title: dto.title,
        statementMd: dto.statementMd,
        language: dto.language,
        starterCode: dto.starterCode,
        solutionCode: dto.solutionCode,
        timeLimitMs: dto.timeLimitMs,
        memoryLimitMb: dto.memoryLimitMb,
        difficulty: dto.difficulty,
        maxScore: dto.maxScore,
        createdById,
      },
      include: withTestCases,
    });
    return toAuthorDetail(created);
  }

  /** Chi tiết cho GV/admin — CÓ hidden test + solutionCode. Route đã chặn bằng coding.read. */
  async getAuthorDetail(id: string): Promise<CodingProblemAuthorDetail> {
    const problem = await this.prisma.codingProblem.findUnique({ where: { id }, include: withTestCases });
    if (!problem) {
      throw new NotFoundException('Bài lập trình không tồn tại');
    }
    return toAuthorDetail(problem);
  }

  async update(id: string, dto: UpdateCodingProblemDto): Promise<CodingProblemAuthorDetail> {
    await this.ensureProblem(id);
    await this.prisma.codingProblem.update({
      where: { id },
      data: {
        title: dto.title,
        statementMd: dto.statementMd,
        starterCode: dto.starterCode,
        solutionCode: dto.solutionCode,
        timeLimitMs: dto.timeLimitMs,
        memoryLimitMb: dto.memoryLimitMb,
        difficulty: dto.difficulty,
        maxScore: dto.maxScore,
      },
    });
    return this.getAuthorDetail(id);
  }

  async remove(id: string): Promise<void> {
    await this.ensureProblem(id);
    await this.prisma.codingProblem.delete({ where: { id } });
  }

  async upsertTestCase(problemId: string, dto: UpsertTestCaseDto): Promise<CodingProblemAuthorDetail> {
    await this.ensureProblem(problemId);
    if (dto.id) {
      // Sửa testcase hiện có — phải thuộc đúng problem (IDOR).
      const existing = await this.prisma.testCase.findUnique({ where: { id: dto.id }, select: { problemId: true } });
      if (!existing || existing.problemId !== problemId) {
        throw new NotFoundException('Testcase không thuộc bài này');
      }
      await this.runCatchingOrder(dto.order, () =>
        this.prisma.testCase.update({
          where: { id: dto.id },
          data: {
            name: dto.name,
            stdin: dto.stdin,
            expectedStdout: dto.expectedStdout,
            kind: dto.kind,
            weight: dto.weight,
            order: dto.order,
          },
        }),
      );
    } else {
      const order = dto.order ?? (await this.nextTestCaseOrder(problemId));
      await this.runCatchingOrder(order, () =>
        this.prisma.testCase.create({
          data: {
            problemId,
            name: dto.name ?? null,
            stdin: dto.stdin,
            expectedStdout: dto.expectedStdout,
            kind: dto.kind,
            weight: dto.weight,
            order,
          },
        }),
      );
    }
    return this.getAuthorDetail(problemId);
  }

  async removeTestCase(problemId: string, testCaseId: string): Promise<CodingProblemAuthorDetail> {
    await this.ensureProblem(problemId);
    const tc = await this.prisma.testCase.findUnique({ where: { id: testCaseId }, select: { problemId: true } });
    if (!tc || tc.problemId !== problemId) {
      throw new NotFoundException('Testcase không thuộc bài này');
    }
    await this.prisma.testCase.delete({ where: { id: testCaseId } });
    return this.getAuthorDetail(problemId);
  }

  // --- Student (làm bài) — CHỈ sample test, KHÔNG solutionCode/hidden ---

  /**
   * Đề cho học viên trong một lớp: kiểm membership + khóa thuộc lớp + gate (nếu gắn lesson).
   * INVARIANT: chỉ trả sample tests; hidden test + solutionCode KHÔNG BAO GIỜ ra client khi làm bài.
   */
  async getStudentDetail(id: string, classId: string, userId: string): Promise<CodingProblemStudentDetail> {
    const problem = await this.prisma.codingProblem.findUnique({ where: { id }, include: withTestCases });
    if (!problem) {
      throw new NotFoundException('Bài lập trình không tồn tại');
    }
    await this.ensureActiveMember(classId, userId);
    await this.ensureCourseInClass(classId, problem.courseId);
    if (problem.lessonId) {
      await this.ensureLessonGateActive(classId, problem.lessonId);
    }
    return toStudentDetail(problem);
  }

  /**
   * Danh sách bài lập trình học viên trong lớp CÓ THỂ làm: thuộc khóa đã gán lớp (ClassCourse) và
   * (không gắn lesson HOẶC lesson đã mở gate isActive). Chỉ summary — KHÔNG hidden test/solution.
   * Không @RequirePermission ở route: quyền = học viên active của lớp (kiểm ở đây).
   */
  async listForClass(classId: string, userId: string): Promise<CodingProblemSummary[]> {
    await this.ensureActiveMember(classId, userId);

    const classCourses = await this.prisma.classCourse.findMany({
      where: { classId },
      select: { courseId: true },
    });
    const courseIds = classCourses.map((c) => c.courseId);
    if (courseIds.length === 0) {
      return [];
    }

    const [problems, gates] = await this.prisma.$transaction([
      this.prisma.codingProblem.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lessonGate.findMany({
        where: { classId, isActive: true },
        select: { lessonId: true },
      }),
    ]);

    const openLessons = new Set(gates.map((g) => g.lessonId));
    return problems
      .filter((p) => p.lessonId === null || openLessons.has(p.lessonId))
      .map(toSummary);
  }

  // --- Submission (nộp chính thức + xem kết quả) ---

  /**
   * Nộp bài chính thức: kiểm membership + khóa thuộc lớp + gate, tạo submission status=queued rồi
   * đẩy vào queue chấm server-side. KHÔNG tin source làm điểm — điểm do autograder tính lại.
   * Không gắn @RequirePermission ở route: quyền nộp = là học viên active của lớp (kiểm ở đây).
   */
  async submit(
    problemId: string,
    userId: string,
    dto: SubmitCodingSubmissionDto,
  ): Promise<CodingSubmissionDto> {
    const problem = await this.prisma.codingProblem.findUnique({
      where: { id: problemId },
      select: { id: true, courseId: true, lessonId: true, language: true },
    });
    if (!problem) {
      throw new NotFoundException('Bài lập trình không tồn tại');
    }
    await this.ensureActiveMember(dto.classId, userId);
    await this.ensureCourseInClass(dto.classId, problem.courseId);
    if (problem.lessonId) {
      await this.ensureLessonGateActive(dto.classId, problem.lessonId);
    }

    const created = await this.prisma.codingSubmission.create({
      data: {
        problemId,
        userId,
        classId: dto.classId,
        sourceCode: dto.sourceCode,
        language: dto.language ?? problem.language,
        status: 'queued',
      },
      select: { id: true },
    });

    await this.queue.enqueue(created.id);

    // Trả trạng thái mới nhất (inline driver đã chấm xong; bull driver vẫn queued).
    return this.getSubmissionForOwner(created.id);
  }

  /**
   * Xem một submission: chủ sở hữu, hoặc GV/TA có coding.result.read theo lớp của submission.
   * Không có :classId trên route nên scope kiểm trong service theo sub.classId (giống submissions.findOne).
   */
  async getSubmission(id: string, currentUser: AuthPrincipal): Promise<CodingSubmissionDto> {
    const sub = await this.loadSubmission(id);
    if (sub.userId !== currentUser.userId) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.userId);
      if (!this.rbac.hasPermission(eff, PERMISSIONS.CODING_RESULT_READ, sub.classId ?? undefined)) {
        throw new ForbiddenException('Không có quyền xem kết quả bài nộp này');
      }
    }
    return toSubmissionDto(sub);
  }

  private async getSubmissionForOwner(id: string): Promise<CodingSubmissionDto> {
    return toSubmissionDto(await this.loadSubmission(id));
  }

  private async loadSubmission(id: string): Promise<SubmissionWithResults> {
    const sub = await this.prisma.codingSubmission.findUnique({
      where: { id },
      include: withResults,
    });
    if (!sub) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }
    return sub;
  }

  // --- helpers ---

  private async ensureProblem(id: string): Promise<void> {
    const p = await this.prisma.codingProblem.findUnique({ where: { id }, select: { id: true } });
    if (!p) {
      throw new NotFoundException('Bài lập trình không tồn tại');
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
      throw new BadRequestException('Bài không thuộc khóa học của lớp này');
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

  private async nextTestCaseOrder(problemId: string): Promise<number> {
    const agg = await this.prisma.testCase.aggregate({ where: { problemId }, _max: { order: true } });
    return (agg._max.order ?? -1) + 1;
  }

  private async runCatchingOrder<T>(order: number | undefined, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Thứ tự testcase đã tồn tại: ${order}`);
      }
      throw e;
    }
  }
}

// --- mappers ---

function toSummary(p: {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  language: string;
  difficulty: string;
  maxScore: unknown;
  timeLimitMs: number;
  memoryLimitMb: number;
  createdAt: Date;
}): CodingProblemSummary {
  return {
    id: p.id,
    courseId: p.courseId,
    lessonId: p.lessonId,
    title: p.title,
    language: p.language,
    difficulty: p.difficulty,
    maxScore: Number(p.maxScore),
    timeLimitMs: p.timeLimitMs,
    memoryLimitMb: p.memoryLimitMb,
    createdAt: p.createdAt.toISOString(),
  };
}

/** GV/admin: đầy đủ testcase (kind + weight) + solutionCode. KHÔNG dùng cho student. */
function toAuthorDetail(p: ProblemWithTests): CodingProblemAuthorDetail {
  return {
    ...toSummary(p),
    statementMd: p.statementMd,
    starterCode: p.starterCode,
    solutionCode: p.solutionCode,
    testCases: p.testCases.map((t) => ({
      id: t.id,
      name: t.name,
      stdin: t.stdin,
      expectedStdout: t.expectedStdout,
      kind: t.kind,
      weight: Number(t.weight),
      order: t.order,
    })),
  };
}

/**
 * Student: CHỈ sample tests, KHÔNG solutionCode, KHÔNG hidden test.
 * Đây là ranh giới bảo mật cốt lõi của P3 — đừng thêm field hidden/solution vào đây.
 */
function toStudentDetail(p: ProblemWithTests): CodingProblemStudentDetail {
  return {
    ...toSummary(p),
    statementMd: p.statementMd,
    starterCode: p.starterCode,
    sampleTests: p.testCases
      .filter((t) => t.kind === 'sample')
      .map((t) => ({
        id: t.id,
        name: t.name,
        stdin: t.stdin,
        expectedStdout: t.expectedStdout,
        order: t.order,
      })),
  };
}

/**
 * Submission + kết quả cho client. KHÔNG lộ stdin/expectedStdout của testcase (nhất là hidden);
 * chỉ trả output của CHÍNH học viên (actualStdout) + trạng thái/điểm đã chấm server-side.
 */
function toSubmissionDto(s: SubmissionWithResults): CodingSubmissionDto {
  const results = [...s.results]
    .sort((a, b) => a.testCase.order - b.testCase.order)
    .map((r) => ({
      id: r.id,
      testCaseId: r.testCaseId,
      name: r.testCase.name,
      status: r.status,
      actualStdout: r.actualStdout,
      runtimeMs: r.runtimeMs,
      order: r.testCase.order,
    }));
  return {
    id: s.id,
    problemId: s.problemId,
    userId: s.userId,
    classId: s.classId,
    language: s.language,
    status: s.status,
    score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
    runtimeMs: s.runtimeMs,
    memoryKb: s.memoryKb,
    submittedAt: s.submittedAt.toISOString(),
    results,
  };
}
