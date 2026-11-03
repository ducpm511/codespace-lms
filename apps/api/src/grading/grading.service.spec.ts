import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types';
import { GradingService } from './grading.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';

const dummyUser: AuthPrincipal = { userId: 'u1' };

function makePrisma() {
  return {
    class: {
      findUnique: jest.fn(),
    },
    classMember: {
      findUnique: jest.fn(),
    },
    gradeItem: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    gradeEntry: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    submission: {
      findMany: jest.fn(),
    },
    quizAttempt: {
      findMany: jest.fn(),
    },
    codingSubmission: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeRbac() {
  return {
    getEffectivePermissions: jest.fn().mockResolvedValue([]),
    hasPermission: jest.fn().mockReturnValue(true),
  };
}

describe('GradingService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let rbac: ReturnType<typeof makeRbac>;
  let service: GradingService;

  beforeEach(() => {
    prisma = makePrisma();
    rbac = makeRbac();
    service = new GradingService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
    );
  });

  describe('getClassGradebook', () => {
    it('404 khi lớp học không tồn tại', async () => {
      prisma.class.findUnique.mockResolvedValue(null);
      await expect(
        service.getClassGradebook('class-ghost', dummyUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('recompute tổng hợp sổ điểm từ assignment, quiz, coding', async () => {
      prisma.class.findUnique.mockResolvedValue({
        id: 'c1',
        courses: [
          {
            course: {
              assignments: [{ id: 'a1', title: 'BT1', maxScore: '100' }],
              quizzes: [{ id: 'q1', title: 'Quiz1', questions: [{ points: '100' }] }],
              codingProblems: [{ id: 'cp1', title: 'Code1', maxScore: '100' }],
            },
          },
        ],
        members: [
          { userId: 'u1', user: { fullName: 'User 1', email: 'u1@test.com' } },
        ],
      });

      prisma.gradeItem.upsert
        .mockResolvedValueOnce({ id: 'gi1', classId: 'c1', sourceType: 'assignment', sourceId: 'a1', title: 'BT1', weight: '1', maxScore: '100' })
        .mockResolvedValueOnce({ id: 'gi2', classId: 'c1', sourceType: 'quiz', sourceId: 'q1', title: 'Quiz1', weight: '1', maxScore: '100' })
        .mockResolvedValueOnce({ id: 'gi3', classId: 'c1', sourceType: 'coding', sourceId: 'cp1', title: 'Code1', weight: '1', maxScore: '100' });

      prisma.submission.findMany.mockResolvedValue([
        { assignmentId: 'a1', userId: 'u1', score: '90' },
      ]);
      prisma.quizAttempt.findMany.mockResolvedValue([
        { quizId: 'q1', userId: 'u1', score: '80' },
      ]);
      prisma.codingSubmission.findMany.mockResolvedValue([
        { problemId: 'cp1', userId: 'u1', score: '100' },
      ]);

      prisma.gradeEntry.findMany.mockResolvedValue([
        { gradeItemId: 'gi1', userId: 'u1', score: '90' },
        { gradeItemId: 'gi2', userId: 'u1', score: '80' },
        { gradeItemId: 'gi3', userId: 'u1', score: '100' },
      ]);

      const res = await service.recomputeClassGradebook('c1', dummyUser);
      expect(res.classId).toBe('c1');
      expect(res.items.length).toBe(3);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].totalWeightedScore).toBe(90);
      expect(res.rows[0].completionRate).toBe(100);
    });
  });

  describe('getStudentOwnGradebook', () => {
    it('403 khi người dùng không phải học viên active', async () => {
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(
        service.getStudentOwnGradebook('c1', { userId: 'u-ghost' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    describe('regression: không phải đợi giáo viên mở sổ mới thấy điểm', () => {
      const classWithSources = {
        id: 'c1',
        courses: [
          {
            course: {
              assignments: [{ id: 'a1', title: 'BT1', maxScore: '100' }],
              quizzes: [{ id: 'q1', title: 'Quiz1', questions: [{ points: '50' }, { points: '50' }] }],
              codingProblems: [{ id: 'cp1', title: 'Code1', maxScore: '100' }],
            },
          },
        ],
      };

      beforeEach(() => {
        prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
        prisma.class.findUnique.mockResolvedValue(classWithSources);
        prisma.submission.findMany.mockResolvedValue([]);
        prisma.quizAttempt.findMany.mockResolvedValue([]);
        prisma.codingSubmission.findMany.mockResolvedValue([
          { problemId: 'cp1', userId: 'u1', score: '50' },
          { problemId: 'cp1', userId: 'u1', score: '100' },
        ]);
      });

      it('lớp chưa từng tổng hợp: đủ mọi cột, điểm lấy lần cao nhất, tổng tính trên cả cột chưa làm', async () => {
        const res = await service.getStudentOwnGradebook('c1', dummyUser);

        expect(res.items.map((i) => i.sourceId).sort()).toEqual(['a1', 'cp1', 'q1']);
        const coding = res.items.find((i) => i.sourceType === 'coding');
        expect(res.grades[coding?.id as string]).toBe(100);
        expect(res.totalWeightedScore).toBe(33.33);
        expect(res.completionRate).toBe(33);
      });

      it('chỉ đọc: học viên không kích hoạt ghi sổ, và chỉ đọc điểm của chính mình', async () => {
        await service.getStudentOwnGradebook('c1', dummyUser);

        expect(prisma.gradeItem.upsert).not.toHaveBeenCalled();
        expect(prisma.gradeEntry.upsert).not.toHaveBeenCalled();
        for (const query of [prisma.submission, prisma.quizAttempt, prisma.codingSubmission]) {
          expect(query.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({ classId: 'c1', userId: { in: ['u1'] } }),
            }),
          );
        }
      });

      it('cột đã có trong sổ giữ nguyên id và trọng số giáo viên thấy', async () => {
        prisma.gradeItem.findMany.mockResolvedValue([
          { id: 'gi3', classId: 'c1', sourceType: 'coding', sourceId: 'cp1', title: 'Tên cũ', weight: '2', maxScore: '100' },
        ]);

        const res = await service.getStudentOwnGradebook('c1', dummyUser);

        const coding = res.items.find((i) => i.sourceType === 'coding');
        expect(coding).toMatchObject({ id: 'gi3', weight: 2, title: 'Code1' });
        expect(res.grades.gi3).toBe(100);
        // (100% × 2 + 0 + 0) / (2 + 1 + 1)
        expect(res.totalWeightedScore).toBe(50);
      });

      it('404 khi lớp không tồn tại', async () => {
        prisma.class.findUnique.mockResolvedValue(null);
        await expect(service.getStudentOwnGradebook('c1', dummyUser)).rejects.toBeInstanceOf(NotFoundException);
      });
    });
  });
});
