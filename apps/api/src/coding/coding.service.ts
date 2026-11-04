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
  type ClassCodingOverviewDto,
  type ClassCodingProblemSubmissionsDto,
  type CodingProblemAuthorDetail,
  type CodingProblemForClass,
  type CodingProblemStudentDetail,
  type CodingProblemSummary,
  type CodingSubmissionDto,
  type CodingSubmissionReviewDto,
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

/** Chỉ dùng cho màn GV: có stdin/expectedStdout của cả test ẩn. */
const withReview = {
  results: {
    include: {
      testCase: { select: { name: true, order: true, kind: true, stdin: true, expectedStdout: true } },
    },
  },
  user: { select: { fullName: true } },
  problem: { select: { title: true, maxScore: true } },
} satisfies Prisma.CodingSubmissionInclude;

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
   * Ai được đọc bài nộp của người khác trong lớp. Role `student` cũng có `coding.result.read` (để xem bài
   * của mình), nên phải kèm `coding.read`. Phần phụ trách lớp: xem `RbacService.isClassStaff`.
   */
  private async assertCanReviewSubmissions(classId: string | null, userId: string): Promise<void> {
    const allowed = await this.rbac.isClassStaff(userId, classId, [
      PERMISSIONS.CODING_RESULT_READ,
      PERMISSIONS.CODING_READ,
    ]);
    if (!allowed) {
      throw new ForbiddenException('Bạn không phụ trách lớp này');
    }
  }

  // --- Giáo viên xem bài nộp theo lớp ---

  /** Các bài của lớp kèm số học viên đã nộp/đạt. Tính cả bài chưa mở gate để GV biết vì sao chưa ai nộp. */
  async getClassCodingOverview(classId: string, userId: string): Promise<ClassCodingOverviewDto> {
    await this.ensureClassExists(classId);
    await this.assertCanReviewSubmissions(classId, userId);

    const classCourses = await this.prisma.classCourse.findMany({
      where: { classId },
      select: { courseId: true },
    });
    const [problems, gates, members, submissions] = await this.prisma.$transaction([
      this.prisma.codingProblem.findMany({
        where: { courseId: { in: classCourses.map((c) => c.courseId) } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lessonGate.findMany({
        where: { classId, isActive: true },
        select: { lessonId: true },
      }),
      this.prisma.classMember.findMany({
        where: { classId, roleInClass: 'student' },
        select: { userId: true, status: true },
      }),
      this.prisma.codingSubmission.findMany({
        where: { classId },
        select: { problemId: true, userId: true, status: true },
        distinct: ['problemId', 'userId', 'status'],
      }),
    ]);

    const openLessons = new Set(gates.map((g) => g.lessonId));
    const students = new Set(members.map((m) => m.userId));
    const submitted = new Map<string, Set<string>>();
    const passed = new Map<string, Set<string>>();
    for (const s of submissions) {
      // Bài GV/TA tự nộp thử không tính vào số liệu của học viên.
      if (!students.has(s.userId)) continue;
      addToSet(submitted, s.problemId, s.userId);
      if (s.status === 'passed') addToSet(passed, s.problemId, s.userId);
    }

    return {
      classId,
      studentCount: members.filter((m) => m.status === 'active').length,
      problems: problems.map((p) => ({
        ...toSummary(p),
        isOpen: p.lessonId === null || openLessons.has(p.lessonId),
        submittedCount: submitted.get(p.id)?.size ?? 0,
        passedCount: passed.get(p.id)?.size ?? 0,
      })),
    };
  }

  /** Cả lớp với một bài: ai đã nộp, số lần, điểm cao nhất, lần gần nhất. Không kèm code. */
  async getClassProblemSubmissions(
    classId: string,
    problemId: string,
    userId: string,
  ): Promise<ClassCodingProblemSubmissionsDto> {
    await this.ensureClassExists(classId);
    await this.assertCanReviewSubmissions(classId, userId);

    const problem = await this.prisma.codingProblem.findUnique({ where: { id: problemId } });
    const inClass =
      problem &&
      (await this.prisma.classCourse.findUnique({
        where: { classId_courseId: { classId, courseId: problem.courseId } },
        select: { id: true },
      }));
    if (!problem || !inClass) {
      throw new NotFoundException('Bài lập trình không thuộc lớp này');
    }

    const [members, submissions] = await this.prisma.$transaction([
      this.prisma.classMember.findMany({
        where: { classId, roleInClass: 'student' },
        select: { userId: true, status: true, user: { select: { fullName: true, email: true } } },
      }),
      this.prisma.codingSubmission.findMany({
        where: { classId, problemId },
        select: { id: true, userId: true, status: true, score: true, submittedAt: true },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const byUser = new Map<string, typeof submissions>();
    for (const s of submissions) {
      byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
    }

    const students = members
      // Em đã rời lớp mà chưa nộp thì không còn liên quan; đã nộp thì bài vẫn phải xem được.
      .filter((m) => m.status === 'active' || byUser.has(m.userId))
      .map((m) => {
        const rows = byUser.get(m.userId) ?? [];
        return {
          userId: m.userId,
          fullName: m.user.fullName,
          email: m.user.email,
          isActiveMember: m.status === 'active',
          ...(rows.length > 0
            ? summarizeAttempts(rows)
            : { attempts: 0, passed: false, bestScore: null, latestStatus: null }),
          submissions: rows.map((s) => ({
            id: s.id,
            status: s.status,
            score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
            submittedAt: s.submittedAt.toISOString(),
          })),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

    return { classId, problem: toSummary(problem), students };
  }

  /**
   * Một lần nộp cho GV: có code và test ẩn. Lớp lấy từ chính bài nộp, không nhận từ client nên không thể
   * mượn lớp mình để đọc bài lớp khác. Người xem là chủ bài nộp vẫn phải qua cổng này: DTO có test ẩn.
   */
  async getSubmissionReview(id: string, userId: string): Promise<CodingSubmissionReviewDto> {
    const sub = await this.prisma.codingSubmission.findUnique({ where: { id }, include: withReview });
    if (!sub) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }
    await this.assertCanReviewSubmissions(sub.classId, userId);

    const reviewById = new Map(sub.results.map((r) => [r.id, r.testCase]));
    const dto = toSubmissionDto(sub, { revealHiddenOutput: true });
    return {
      ...dto,
      sourceCode: sub.sourceCode,
      studentName: sub.user.fullName,
      problemTitle: sub.problem.title,
      maxScore: Number(sub.problem.maxScore),
      results: (dto.results ?? []).map((r) => {
        const testCase = reviewById.get(r.id);
        return {
          ...r,
          kind: testCase?.kind ?? 'hidden',
          stdin: testCase?.stdin ?? '',
          expectedStdout: testCase?.expectedStdout ?? '',
        };
      }),
    };
  }

  private async ensureClassExists(classId: string): Promise<void> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }
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

function addToSet(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
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
