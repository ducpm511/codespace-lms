import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CodingService } from './coding.service';
import type { PrismaService } from '../prisma/prisma.service';

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
    course: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    classMember: { findUnique: jest.fn() },
    classCourse: { findUnique: jest.fn() },
    lessonGate: { findUnique: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

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
  let service: CodingService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CodingService(prisma as unknown as PrismaService);
  });

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
});
