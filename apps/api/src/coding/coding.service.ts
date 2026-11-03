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
  type CodingProblemForClass,
  type CodingProblemStudentDetail,
  type CodingProblemSummary,
  type CodingSubmissionDto,
  type MyCodingProgressDto,
  type MyCodingStatusDto,
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
  results: { include: { testCase: { select: { name: true, order: true, kind: true } } } },
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
    return { ...toStudentDetail(problem), myProgress: await this.loadMyProgress(id, classId, userId) };
  }

  /** Bài nộp của chính học viên trong đúng lớp này, để vào lại vẫn thấy trạng thái, điểm và code. */
  private async loadMyProgress(problemId: string, classId: string, userId: string): Promise<MyCodingProgressDto> {
    const rows = await this.prisma.codingSubmission.findMany({
      where: { problemId, userId, classId },
      select: { id: true, status: true, score: true },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    });
    if (rows.length === 0) {
      return { attempts: 0, passed: false, bestScore: null, latestStatus: null, latest: null };
    }
    const latest = await this.loadSubmission(rows[0].id);
    return {
      ...summarizeAttempts(rows),
      latest: { ...toSubmissionDto(latest), sourceCode: latest.sourceCode },
    };
  }

  /**
   * Danh sách bài lập trình học viên trong lớp CÓ THỂ làm: thuộc khóa đã gán lớp (ClassCourse) và
   * (không gắn lesson HOẶC lesson đã mở gate isActive). Chỉ summary — KHÔNG hidden test/solution.
   * Không @RequirePermission ở route: quyền = học viên active của lớp (kiểm ở đây).
   */
  async listForClass(classId: string, userId: string): Promise<CodingProblemForClass[]> {
    await this.ensureActiveMember(classId, userId);

    const classCourses = await this.prisma.classCourse.findMany({
      where: { classId },
      select: { courseId: true },
    });
    const courseIds = classCourses.map((c) => c.courseId);
    if (courseIds.length === 0) {
      return [];
    }

    const [problems, gates, submissions] = await this.prisma.$transaction([
      this.prisma.codingProblem.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lessonGate.findMany({
        where: { classId, isActive: true },
        select: { lessonId: true },
      }),
      this.prisma.codingSubmission.findMany({
        where: { userId, classId },
        select: { problemId: true, status: true, score: true },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const byProblem = new Map<string, typeof submissions>();
    for (const s of submissions) {
      byProblem.set(s.problemId, [...(byProblem.get(s.problemId) ?? []), s]);
    }

    const openLessons = new Set(gates.map((g) => g.lessonId));
    return problems
      .filter((p) => p.lessonId === null || openLessons.has(p.lessonId))
      .map((p) => {
        const rows = byProblem.get(p.id);
        return { ...toSummary(p), myStatus: rows ? summarizeAttempts(rows) : null };
      });
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
      await this.assertCanReviewSubmissions(sub.classId, currentUser.userId);
      return toSubmissionDto(sub, { revealHiddenOutput: true });
    }
    return toSubmissionDto(sub);
  }

  /**
   * Ai được đọc bài nộp của người khác trong lớp. Chỉ `coding.result.read` là chưa đủ, vì quyền này:
   * - role `student` cũng có (để xem bài của mình), gán global thì học viên đọc được bài của bạn;
   * - role `instructor` đang gán GLOBAL (nợ kỹ thuật đã biết), nên GV bất kỳ đọc được lớp người khác.
   *
   * `coding.read` (học viên không có) tách staff khỏi học viên. Trong staff, phải có quyền gán riêng cho
   * lớp này, hoặc là người tạo lớp / instructor, TA đang hoạt động của lớp, hoặc là admin. Admin nhận
   * `class.delete` global; instructor không có (INVARIANT #3).
   *
   * `classId` null = lớp đã bị xóa, không còn ai phụ trách nên chỉ admin đọc được.
   */
  private async assertCanReviewSubmissions(classId: string | null, userId: string): Promise<void> {
    const eff = await this.rbac.getEffectivePermissions(userId);
    const scope = classId ?? undefined;
    const isStaff =
      this.rbac.hasPermission(eff, PERMISSIONS.CODING_RESULT_READ, scope) &&
      this.rbac.hasPermission(eff, PERMISSIONS.CODING_READ, scope);
    if (!isStaff) {
      throw new ForbiddenException('Không có quyền xem bài nộp của lớp này');
    }
    if (eff.global.has(PERMISSIONS.CLASS_DELETE)) return;
    if (classId) {
      if (eff.byClass.get(classId)?.has(PERMISSIONS.CODING_RESULT_READ)) return;
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: {
          createdById: true,
          members: { where: { userId }, select: { status: true, roleInClass: true } },
        },
      });
      const member = cls?.members[0];
      const teachesClass =
        member?.status === 'active' && (member.roleInClass === 'instructor' || member.roleInClass === 'ta');
      if (cls?.createdById === userId || teachesClass) return;
    }
    throw new ForbiddenException('Bạn không phụ trách lớp này');
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

/** `rows` đã xếp mới nhất trước và không rỗng. bestScore lấy lần cao nhất, cùng cách tính với sổ điểm. */
function summarizeAttempts(rows: { status: string; score: unknown }[]): MyCodingStatusDto {
  const scores = rows.filter((r) => r.score !== null && r.score !== undefined).map((r) => Number(r.score));
  return {
    attempts: rows.length,
    passed: rows.some((r) => r.status === 'passed'),
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
    latestStatus: rows[0].status,
  };
}

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
function toStudentDetail(p: ProblemWithTests): Omit<CodingProblemStudentDetail, 'myProgress'> {
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
 *
 * Output của test ẩn chỉ dành cho GV: code `print(input())` sẽ in nguyên input ẩn, trả cho học viên là
 * lộ testcase ẩn (INVARIANT domain). Học viên vẫn thấy test ẩn đạt hay không qua `status`.
 */
function toSubmissionDto(
  s: SubmissionWithResults,
  { revealHiddenOutput = false }: { revealHiddenOutput?: boolean } = {},
): CodingSubmissionDto {
  const results = [...s.results]
    .sort((a, b) => a.testCase.order - b.testCase.order)
    .map((r) => ({
      id: r.id,
      testCaseId: r.testCaseId,
      name: r.testCase.name,
      status: r.status,
      actualStdout: r.testCase.kind === 'hidden' && !revealHiddenOutput ? null : r.actualStdout,
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
