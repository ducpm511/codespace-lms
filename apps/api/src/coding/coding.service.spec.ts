import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CodingService } from './coding.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import type { SubmissionQueue } from './queue/submission-queue';
import type { AuthPrincipal } from '../auth/auth.types';

function makePrisma() {
  return {
    codingProblem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    testCase: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), aggregate: jest.fn() },
    codingSubmission: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    course: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    class: { findUnique: jest.fn() },
    classMember: { findUnique: jest.fn(), findMany: jest.fn() },
    classCourse: { findUnique: jest.fn(), findMany: jest.fn() },
    lessonGate: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeRbac() {
  return { getEffectivePermissions: jest.fn().mockResolvedValue([]), hasPermission: jest.fn().mockReturnValue(false) };
}

const principal = (userId: string): AuthPrincipal => ({ userId }) as AuthPrincipal;

const INSTRUCTOR_PERMS = ['coding.read', 'coding.result.read'];

const now = new Date('2026-08-13T00:00:00.000Z');

function problemRow(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    courseId: 'c1',
    lessonId: null,
    title: 'Sum two numbers',
    statementMd: 'Read a, b; print a+b',
    language: 'python',
    starterCode: '# code here',
    solutionCode: 'print(sum(map(int, input().split())))', // BÍ MẬT
    difficulty: 'easy',
    maxScore: '100',
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    createdAt: now,
    testCases: [
      { id: 't1', name: 'sample', stdin: '1 2', expectedStdout: '3', kind: 'sample', weight: '1', order: 0 },
      { id: 't2', name: 'hidden', stdin: '10 20', expectedStdout: '30', kind: 'hidden', weight: '2', order: 1 },
    ],
    ...over,
  };
}

describe('CodingService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let rbac: ReturnType<typeof makeRbac>;
  let queue: { enqueue: jest.Mock };
  let service: CodingService;

  beforeEach(() => {
    prisma = makePrisma();
    rbac = makeRbac();
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new CodingService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
      queue as unknown as SubmissionQueue,
    );
  });

  /** Quyền hiệu lực thật, chấm bằng đúng logic của RbacService: mock trả true/false sẽ che mất lỗi phạm vi. */
  const grant = (global: string[], byClass: Record<string, string[]> = {}) => {
    rbac.getEffectivePermissions.mockResolvedValue({
      global: new Set(global),
      byClass: new Map(Object.entries(byClass).map(([id, keys]) => [id, new Set(keys)])),
    });
    rbac.hasPermission.mockImplementation(RbacService.prototype.hasPermission);
  };

  describe('getAuthorDetail', () => {
    it('GV thấy ĐẦY ĐỦ hidden test + solutionCode', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      const res = await service.getAuthorDetail('p1');
      expect(res.solutionCode).toContain('print');
      expect(res.testCases).toHaveLength(2);
      expect(res.testCases.map((t) => t.kind).sort()).toEqual(['hidden', 'sample']);
      expect(res.testCases[0].weight).toBe(1);
    });

    it('404 khi không tồn tại', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(null);
      await expect(service.getAuthorDetail('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update (sửa đề bài)', () => {
    it('sửa được statementMd mà KHÔNG đụng các trường khác', async () => {
      // Prisma coi `undefined` là "đừng đổi". Form sửa đề dựa vào đúng tính chất này: chỉ gửi
      // những trường người dùng thực sự chạm tới.
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      prisma.codingProblem.update.mockResolvedValue({});

      await service.update('p1', { statementMd: '# Đề bài mới' });

      expect(prisma.codingProblem.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          title: undefined,
          statementMd: '# Đề bài mới',
          starterCode: undefined,
          solutionCode: undefined,
          timeLimitMs: undefined,
          memoryLimitMb: undefined,
          difficulty: undefined,
          maxScore: undefined,
        },
      });
    });

    it('gửi null thì XOÁ HẲN starterCode (khác với bỏ trống = giữ nguyên)', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      prisma.codingProblem.update.mockResolvedValue({});

      await service.update('p1', { starterCode: null });

      expect(prisma.codingProblem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ starterCode: null }) }),
      );
    });

    it('trả về detail của GV sau khi sửa (kèm hidden test + solution)', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow({ title: 'Tên mới' }));
      prisma.codingProblem.update.mockResolvedValue({});

      const res = await service.update('p1', { title: 'Tên mới' });

      expect(res.title).toBe('Tên mới');
      expect(res.testCases).toHaveLength(2);
    });

    it('404 khi bài không tồn tại — không ghi gì cả', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.codingProblem.update).not.toHaveBeenCalled();
    });
  });

  describe('getStudentDetail (INVARIANT: không lộ hidden/solution)', () => {
    const okMembership = () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
    };

    it('CHỈ trả sample test, KHÔNG solutionCode, KHÔNG hidden', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      okMembership();
      const res = await service.getStudentDetail('p1', 'class-1', 'stu-1');
      const flat = res as unknown as Record<string, unknown>;
      // Không có solutionCode
      expect(flat.solutionCode).toBeUndefined();
      // Không có mảng testCases (chỉ có sampleTests)
      expect(flat.testCases).toBeUndefined();
      // sampleTests chỉ gồm sample, không có hidden
      expect(res.sampleTests).toHaveLength(1);
      expect(res.sampleTests[0].id).toBe('t1');
      // sample DTO không rò rỉ kind/weight
      const sample0 = res.sampleTests[0] as unknown as Record<string, unknown>;
      expect(sample0.kind).toBeUndefined();
      expect(sample0.weight).toBeUndefined();
      // đảm bảo stdin hidden không lọt ra bất kỳ đâu
      expect(JSON.stringify(res)).not.toContain('10 20');
      expect(JSON.stringify(res)).not.toContain('print(sum');
    });

    it('403 khi không phải thành viên active', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(service.getStudentDetail('p1', 'class-1', 'stu-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 khi lesson gắn bài chưa mở gate', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow({ lessonId: 'l1' }));
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: false });
      await expect(service.getStudentDetail('p1', 'class-1', 'stu-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create', () => {
    it('404 khi course không tồn tại', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ courseId: 'ghost', title: 'X', statementMd: 'Y' }, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 khi lessonId không thuộc course', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.lesson.findUnique.mockResolvedValue({ section: { courseId: 'other' } });
      await expect(
        service.create({ courseId: 'c1', lessonId: 'l1', title: 'X', statementMd: 'Y' }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('upsertTestCase (IDOR)', () => {
    it('404 khi sửa testcase thuộc problem khác', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.testCase.findUnique.mockResolvedValue({ problemId: 'other' });
      await expect(
        service.upsertTestCase('p1', { id: 't9', stdin: '', expectedStdout: '', kind: 'sample' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  function submissionRow(over: Record<string, unknown> = {}) {
    return {
      id: 'sub1',
      problemId: 'p1',
      userId: 'stu-1',
      classId: 'class-1',
      language: 'python',
      status: 'passed',
      score: '100',
      runtimeMs: 5,
      memoryKb: 0,
      submittedAt: now,
      results: [
        { id: 'r1', testCaseId: 't1', status: 'passed', actualStdout: '3', runtimeMs: 5, testCase: { name: 'sample', order: 0 } },
      ],
      ...over,
    };
  }

  describe('submit', () => {
    const okMembership = () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
    };

    it('tạo submission queued + enqueue + trả DTO (không tin điểm client)', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue({ id: 'p1', courseId: 'c1', lessonId: null, language: 'python' });
      okMembership();
      prisma.codingSubmission.create.mockResolvedValue({ id: 'sub1' });
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());

      const res = await service.submit('p1', 'stu-1', { classId: 'class-1', sourceCode: 'print(3)' });

      expect(prisma.codingSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'queued', problemId: 'p1', userId: 'stu-1' }) }),
      );
      expect(queue.enqueue).toHaveBeenCalledWith('sub1');
      expect(res.id).toBe('sub1');
      expect(res.score).toBe(100);
      expect(res.results).toHaveLength(1);
    });

    it('404 khi bài không tồn tại', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue(null);
      await expect(service.submit('ghost', 'stu-1', { classId: 'class-1', sourceCode: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('403 khi không phải thành viên active (không enqueue)', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue({ id: 'p1', courseId: 'c1', lessonId: null, language: 'python' });
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(service.submit('p1', 'stu-1', { classId: 'class-1', sourceCode: 'x' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('403 khi lesson chưa mở gate', async () => {
      prisma.codingProblem.findUnique.mockResolvedValue({ id: 'p1', courseId: 'c1', lessonId: 'l1', language: 'python' });
      okMembership();
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: false });
      await expect(service.submit('p1', 'stu-1', { classId: 'class-1', sourceCode: 'x' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('getSubmission (ownership + scope)', () => {
    it('chủ sở hữu xem được, không cần permission', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());
      const res = await service.getSubmission('sub1', principal('stu-1'));
      expect(res.id).toBe('sub1');
      expect(rbac.hasPermission).not.toHaveBeenCalled();
    });

    it('người khác không có coding.result.read theo lớp → 403', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());
      rbac.hasPermission.mockReturnValue(false);
      await expect(service.getSubmission('sub1', principal('gv-x'))).rejects.toBeInstanceOf(ForbiddenException);
      expect(rbac.hasPermission).toHaveBeenCalledWith(expect.anything(), 'coding.result.read', 'class-1');
    });

    it('GV phụ trách đúng lớp → xem được', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());
      grant(INSTRUCTOR_PERMS);
      prisma.class.findUnique.mockResolvedValue({ createdById: 'gv-x', members: [] });
      const res = await service.getSubmission('sub1', principal('gv-x'));
      expect(res.userId).toBe('stu-1');
    });

    it('regression: học viên có role student global (có coding.result.read) KHÔNG đọc được bài của bạn', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());
      grant(['coding.submit', 'coding.result.read']);
      await expect(service.getSubmission('sub1', principal('stu-2'))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('regression: GV role global KHÔNG đọc được bài của lớp người khác', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());
      grant(INSTRUCTOR_PERMS);
      prisma.class.findUnique.mockResolvedValue({ createdById: 'gv-khac', members: [] });
      await expect(service.getSubmission('sub1', principal('gv-x'))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 khi submission không tồn tại', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(null);
      await expect(service.getSubmission('nope', principal('stu-1'))).rejects.toBeInstanceOf(NotFoundException);
    });

    it('KHÔNG lộ stdin/expectedStdout của testcase (nhất là hidden)', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(submissionRow());
      const res = await service.getSubmission('sub1', principal('stu-1'));
      const flat = JSON.stringify(res);
      expect(flat).not.toContain('stdin');
      expect(flat).not.toContain('expectedStdout');
    });

    describe('regression: output của test ẩn (code `print(input())` sẽ in nguyên input ẩn)', () => {
      const withHiddenResult = () =>
        submissionRow({
          results: [
            { id: 'r1', testCaseId: 't1', status: 'passed', actualStdout: '3', runtimeMs: 5, testCase: { name: 'sample', order: 0, kind: 'sample' } },
            { id: 'r2', testCaseId: 't2', status: 'passed', actualStdout: '10 20', runtimeMs: 5, testCase: { name: 'hidden', order: 1, kind: 'hidden' } },
          ],
        });

      it('chủ bài nộp: thấy trạng thái test ẩn nhưng KHÔNG thấy output; test mẫu vẫn còn output', async () => {
        prisma.codingSubmission.findUnique.mockResolvedValue(withHiddenResult());
        const res = await service.getSubmission('sub1', principal('stu-1'));
        expect(JSON.stringify(res)).not.toContain('10 20');
        expect(res.results?.[1].status).toBe('passed');
        expect(res.results?.[1].actualStdout).toBeNull();
        expect(res.results?.[0].actualStdout).toBe('3');
      });

      it('GV có coding.result.read vẫn thấy output để hỗ trợ học viên', async () => {
        prisma.codingSubmission.findUnique.mockResolvedValue(withHiddenResult());
        grant(INSTRUCTOR_PERMS);
        prisma.class.findUnique.mockResolvedValue({ createdById: 'gv-x', members: [] });
        const res = await service.getSubmission('sub1', principal('gv-x'));
        expect(res.results?.[1].actualStdout).toBe('10 20');
      });

      it('trả về ngay khi nộp và khi vào lại bài cũng không lộ', async () => {
        prisma.codingProblem.findUnique.mockResolvedValue({ ...problemRow(), language: 'python' });
        prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
        prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
        prisma.codingSubmission.create.mockResolvedValue({ id: 'sub1' });
        prisma.codingSubmission.findUnique.mockResolvedValue(withHiddenResult());
        prisma.codingSubmission.findMany.mockResolvedValue([{ id: 'sub1', status: 'passed', score: '100' }]);

        const submitted = await service.submit('p1', 'stu-1', { classId: 'class-1', sourceCode: 'x' });
        expect(JSON.stringify(submitted)).not.toContain('10 20');

        const reopened = await service.getStudentDetail('p1', 'class-1', 'stu-1');
        expect(JSON.stringify(reopened)).not.toContain('10 20');
      });
    });
  });

  describe('giáo viên xem bài nộp theo lớp (ownership)', () => {
    const STUDENT_PERMS = ['coding.submit', 'coding.result.read'];
    const ownClass = { id: 'class-1', createdById: 'gv-1', members: [] };

    /** Ba đường đọc cùng đi qua một cổng quyền; ca sai lớp phải chặn đủ cả ba. */
    const readers: [string, (userId: string) => Promise<unknown>][] = [
      ['tổng quan lớp', (u) => service.getClassCodingOverview('class-1', u)],
      ['danh sách theo bài', (u) => service.getClassProblemSubmissions('class-1', 'p1', u)],
      ['code một lần nộp', (u) => service.getSubmissionReview('sub1', u)],
    ];

    function reviewRow(over: Record<string, unknown> = {}) {
      return {
        ...submissionRow(),
        sourceCode: 'print("bài của em A")',
        user: { fullName: 'Em A' },
        problem: { title: 'Sum two numbers', maxScore: '100' },
        results: [
          { id: 'r1', testCaseId: 't1', status: 'passed', actualStdout: '3', runtimeMs: 5, testCase: { name: 'mẫu', order: 0, kind: 'sample', stdin: '1 2', expectedStdout: '3' } },
          { id: 'r2', testCaseId: 't2', status: 'failed', actualStdout: '10 20', runtimeMs: 5, testCase: { name: 'ẩn', order: 1, kind: 'hidden', stdin: '10 20', expectedStdout: '30' } },
        ],
        ...over,
      };
    }

    beforeEach(() => {
      prisma.class.findUnique.mockResolvedValue(ownClass);
      prisma.codingSubmission.findUnique.mockResolvedValue(reviewRow());
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.classCourse.findMany.mockResolvedValue([{ courseId: 'c1' }]);
      prisma.codingProblem.findMany.mockResolvedValue([]);
      prisma.lessonGate.findMany.mockResolvedValue([]);
      prisma.classMember.findMany.mockResolvedValue([]);
    });

    describe.each(readers)('%s', (_name, read) => {
      it('người tạo lớp có quyền → xem được', async () => {
        grant(INSTRUCTOR_PERMS);
        await expect(read('gv-1')).resolves.toBeDefined();
      });

      it('instructor/TA đang hoạt động của lớp → xem được', async () => {
        grant(INSTRUCTOR_PERMS);
        prisma.class.findUnique.mockResolvedValue({
          ...ownClass,
          members: [{ status: 'active', roleInClass: 'ta' }],
        });
        await expect(read('ta-1')).resolves.toBeDefined();
      });

      it('TA được gán role theo đúng lớp này → xem được', async () => {
        grant([], { 'class-1': INSTRUCTOR_PERMS });
        await expect(read('ta-1')).resolves.toBeDefined();
      });

      it('admin (class.delete global) → xem được lớp bất kỳ', async () => {
        grant([...INSTRUCTOR_PERMS, 'class.delete']);
        await expect(read('admin-1')).resolves.toBeDefined();
      });

      it('sai lớp: GV role global không phụ trách lớp → 403', async () => {
        grant(INSTRUCTOR_PERMS);
        await expect(read('gv-khac')).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('sai lớp: TA được gán role theo lớp KHÁC → 403', async () => {
        grant([], { 'class-2': INSTRUCTOR_PERMS });
        await expect(read('ta-1')).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('GV đã rời lớp (member không active) → 403', async () => {
        grant(INSTRUCTOR_PERMS);
        prisma.class.findUnique.mockResolvedValue({
          ...ownClass,
          members: [{ status: 'removed', roleInClass: 'instructor' }],
        });
        await expect(read('gv-2')).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('học viên cùng lớp có coding.result.read → 403', async () => {
        grant(STUDENT_PERMS);
        prisma.class.findUnique.mockResolvedValue({
          ...ownClass,
          members: [{ status: 'active', roleInClass: 'student' }],
        });
        await expect(read('stu-2')).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    it('404 khi lớp không tồn tại (tổng quan + danh sách)', async () => {
      prisma.class.findUnique.mockResolvedValue(null);
      grant(INSTRUCTOR_PERMS);
      await expect(service.getClassCodingOverview('nope', 'gv-1')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getClassProblemSubmissions('nope', 'p1', 'gv-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 khi bài không tồn tại hoặc không thuộc khóa của lớp', async () => {
      grant(INSTRUCTOR_PERMS);
      prisma.classCourse.findUnique.mockResolvedValue(null);
      await expect(service.getClassProblemSubmissions('class-1', 'p1', 'gv-1')).rejects.toBeInstanceOf(NotFoundException);
      prisma.codingProblem.findUnique.mockResolvedValue(null);
      await expect(service.getClassProblemSubmissions('class-1', 'nope', 'gv-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 khi lần nộp không tồn tại', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(null);
      grant(INSTRUCTOR_PERMS);
      await expect(service.getSubmissionReview('nope', 'gv-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('bài nộp của lớp đã xóa (classId null): chỉ admin đọc được', async () => {
      prisma.codingSubmission.findUnique.mockResolvedValue(reviewRow({ classId: null }));
      grant(INSTRUCTOR_PERMS);
      await expect(service.getSubmissionReview('sub1', 'gv-1')).rejects.toBeInstanceOf(ForbiddenException);
      grant([...INSTRUCTOR_PERMS, 'class.delete']);
      await expect(service.getSubmissionReview('sub1', 'admin-1')).resolves.toBeDefined();
    });

    it('review: GV thấy code, đầu vào/mong đợi/output của cả test ẩn, đúng thứ tự', async () => {
      grant(INSTRUCTOR_PERMS);
      const res = await service.getSubmissionReview('sub1', 'gv-1');
      expect(res.sourceCode).toBe('print("bài của em A")');
      expect(res.studentName).toBe('Em A');
      expect(res.maxScore).toBe(100);
      expect(res.results[1]).toMatchObject({ kind: 'hidden', stdin: '10 20', expectedStdout: '30', actualStdout: '10 20' });
    });

    it('chủ bài nộp là học viên KHÔNG mở được bản review (có test ẩn)', async () => {
      grant(STUDENT_PERMS);
      await expect(service.getSubmissionReview('sub1', 'stu-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('tổng quan: đếm số học viên riêng biệt đã nộp/đạt, bỏ bài GV tự nộp, mẫu số là em đang học', async () => {
      grant(INSTRUCTOR_PERMS);
      prisma.codingProblem.findMany.mockResolvedValue([
        problemRow({ id: 'p1', lessonId: 'l-open' }),
        problemRow({ id: 'p2', lessonId: 'l-closed' }),
      ]);
      prisma.lessonGate.findMany.mockResolvedValue([{ lessonId: 'l-open' }]);
      prisma.classMember.findMany.mockResolvedValue([
        { userId: 'a', status: 'active' },
        { userId: 'b', status: 'active' },
        { userId: 'c', status: 'removed' },
      ]);
      prisma.codingSubmission.findMany.mockResolvedValue([
        { problemId: 'p1', userId: 'a', status: 'failed' },
        { problemId: 'p1', userId: 'a', status: 'passed' },
        { problemId: 'p1', userId: 'b', status: 'failed' },
        { problemId: 'p1', userId: 'gv-1', status: 'passed' },
      ]);

      const res = await service.getClassCodingOverview('class-1', 'gv-1');

      expect(res.studentCount).toBe(2);
      expect(res.problems[0]).toMatchObject({ id: 'p1', isOpen: true, submittedCount: 2, passedCount: 1 });
      expect(res.problems[1]).toMatchObject({ id: 'p2', isOpen: false, submittedCount: 0, passedCount: 0 });
      expect(JSON.stringify(res)).not.toContain('solutionCode');
    });

    it('danh sách: đủ em chưa nộp, điểm cao nhất + trạng thái gần nhất đúng, KHÔNG kèm code', async () => {
      grant(INSTRUCTOR_PERMS);
      prisma.classMember.findMany.mockResolvedValue([
        { userId: 'b', status: 'active', user: { fullName: 'Bình', email: 'b@x.vn' } },
        { userId: 'a', status: 'active', user: { fullName: 'An', email: 'a@x.vn' } },
        { userId: 'gone-no-sub', status: 'removed', user: { fullName: 'Rời lớp chưa nộp', email: 'g@x.vn' } },
        { userId: 'gone', status: 'removed', user: { fullName: 'Đã rời', email: 'd@x.vn' } },
      ]);
      prisma.codingSubmission.findMany.mockResolvedValue([
        { id: 's3', userId: 'a', status: 'failed', score: '40', submittedAt: new Date('2026-11-03T00:00:00Z') },
        { id: 's2', userId: 'a', status: 'passed', score: '100', submittedAt: new Date('2026-11-02T00:00:00Z') },
        { id: 's1', userId: 'gone', status: 'failed', score: null, submittedAt: new Date('2026-11-01T00:00:00Z') },
      ]);

      const res = await service.getClassProblemSubmissions('class-1', 'p1', 'gv-1');

      expect(res.students.map((s) => s.fullName)).toEqual(['An', 'Bình', 'Đã rời']);
      expect(res.students[0]).toMatchObject({ attempts: 2, passed: true, bestScore: 100, latestStatus: 'failed', isActiveMember: true });
      expect(res.students[0].submissions.map((s) => s.id)).toEqual(['s3', 's2']);
      expect(res.students[1]).toMatchObject({ attempts: 0, passed: false, bestScore: null, latestStatus: null, submissions: [] });
      expect(res.students[2].isActiveMember).toBe(false);
      expect(JSON.stringify(res)).not.toContain('sourceCode');
      expect(prisma.codingSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { classId: 'class-1', problemId: 'p1' } }),
      );
    });
  });

  describe('listForClass (student list — membership + gate)', () => {
    it('403 khi không phải thành viên active (không truy vấn problem)', async () => {
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(service.listForClass('class-1', 'stu-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.codingProblem.findMany).not.toHaveBeenCalled();
    });

    it('lớp chưa gán khóa nào → trả rỗng', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findMany.mockResolvedValue([]);
      const res = await service.listForClass('class-1', 'stu-1');
      expect(res).toEqual([]);
      expect(prisma.codingProblem.findMany).not.toHaveBeenCalled();
    });

    it('chỉ trả bài không gắn lesson HOẶC lesson đã mở gate; không lộ field nội bộ', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findMany.mockResolvedValue([{ courseId: 'c1' }]);
      prisma.codingProblem.findMany.mockResolvedValue([
        problemRow({ id: 'free', lessonId: null }),
        problemRow({ id: 'gated-open', lessonId: 'l-open' }),
        problemRow({ id: 'gated-closed', lessonId: 'l-closed' }),
      ]);
      prisma.lessonGate.findMany.mockResolvedValue([{ lessonId: 'l-open' }]);

      const res = await service.listForClass('class-1', 'stu-1');

      expect(res.map((p) => p.id).sort()).toEqual(['free', 'gated-open']);
      // Summary không lộ solutionCode / testCases / hidden stdin
      const flat = JSON.stringify(res);
      expect(flat).not.toContain('solutionCode');
      expect(flat).not.toContain('testCases');
      expect(flat).not.toContain('10 20');
      expect(flat).not.toContain('print(sum');
    });

    it('regression: danh sách cho biết học viên đã nộp/đã pass bài nào', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findMany.mockResolvedValue([{ courseId: 'c1' }]);
      prisma.codingProblem.findMany.mockResolvedValue([problemRow({ id: 'done' }), problemRow({ id: 'new' })]);
      prisma.lessonGate.findMany.mockResolvedValue([]);
      prisma.codingSubmission.findMany.mockResolvedValue([
        { problemId: 'done', status: 'failed', score: '40', submittedAt: now },
        { problemId: 'done', status: 'passed', score: '100', submittedAt: new Date(now.getTime() - 1000) },
      ]);

      const res = await service.listForClass('class-1', 'stu-1');

      expect(prisma.codingSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'stu-1', classId: 'class-1' }) }),
      );
      const byId = new Map(res.map((p) => [p.id, p.myStatus]));
      expect(byId.get('done')).toEqual({ attempts: 2, passed: true, bestScore: 100, latestStatus: 'failed' });
      expect(byId.get('new')).toBeNull();
    });
  });

  describe('getStudentDetail — vào lại bài đã nộp (regression)', () => {
    const open = () => {
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow());
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
    };

    it('chưa nộp lần nào → myProgress rỗng, vẫn dùng code mẫu', async () => {
      open();
      const res = await service.getStudentDetail('p1', 'class-1', 'stu-1');
      expect(res.myProgress).toEqual({ attempts: 0, passed: false, bestScore: null, latestStatus: null, latest: null });
    });

    it('đã nộp → trả trạng thái, điểm và code của lần nộp GẦN NHẤT; passed/bestScore giữ theo lần tốt nhất', async () => {
      open();
      prisma.codingSubmission.findMany.mockResolvedValue([
        { id: 'sub2', problemId: 'p1', status: 'failed', score: '40', submittedAt: now },
        { id: 'sub1', problemId: 'p1', status: 'passed', score: '100', submittedAt: new Date(now.getTime() - 1000) },
      ]);
      prisma.codingSubmission.findUnique.mockResolvedValue(
        submissionRow({ id: 'sub2', status: 'failed', score: '40', sourceCode: 'print("lan 2")' }),
      );

      const res = await service.getStudentDetail('p1', 'class-1', 'stu-1');

      // Chỉ đọc bài của CHÍNH học viên trong đúng lớp này.
      expect(prisma.codingSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { problemId: 'p1', userId: 'stu-1', classId: 'class-1' } }),
      );
      expect(prisma.codingSubmission.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub2' } }),
      );
      expect(res.myProgress.attempts).toBe(2);
      expect(res.myProgress.passed).toBe(true);
      expect(res.myProgress.bestScore).toBe(100);
      expect(res.myProgress.latest?.id).toBe('sub2');
      expect(res.myProgress.latest?.status).toBe('failed');
      expect(res.myProgress.latest?.score).toBe(40);
      expect(res.myProgress.latest?.sourceCode).toBe('print("lan 2")');
    });

    it('trước gate vẫn 403, không đọc bài nộp', async () => {
      open();
      prisma.codingProblem.findUnique.mockResolvedValue(problemRow({ lessonId: 'l1' }));
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: false });
      await expect(service.getStudentDetail('p1', 'class-1', 'stu-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.codingSubmission.findMany).not.toHaveBeenCalled();
    });
  });
});
