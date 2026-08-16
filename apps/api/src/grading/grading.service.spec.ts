import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@lms/contracts';
import { GradingService } from './grading.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';

const dummyUser: AuthUser = { id: 'u1', email: 'u1@test.com', fullName: 'User 1', status: 'active', roles: [], permissions: [] };

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

    it('tổng hợp sổ điểm từ assignment, quiz, coding', async () => {
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

      const res = await service.getClassGradebook('c1', dummyUser);
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
        service.getStudentOwnGradebook('c1', { ...dummyUser, id: 'u-ghost' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
