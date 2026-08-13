import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';

function makePrisma() {
  return {
    assignment: {
      findUnique: jest.fn(),
    },
    submission: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    classMember: {
      findUnique: jest.fn(),
    },
    classCourse: {
      findUnique: jest.fn(),
    },
    lessonGate: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeRbac() {
  return {
    getEffectivePermissions: jest.fn(),
    hasPermission: jest.fn(),
  };
}

const now = new Date('2026-08-13T00:00:00.000Z');

function sampleSubmission(over: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    assignmentId: 'a1',
    userId: 'student-1',
    classId: 'class-1',
    status: 'draft',
    contentText: 'Nội dung bài làm',
    linkUrl: null,
    fileId: null,
    score: null,
    feedbackMd: null,
    submittedAt: null,
    gradedAt: null,
    user: { email: 'student1@codespace.vn', fullName: 'Học Viên 1' },
    ...over,
  };
}

describe('SubmissionsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let rbac: ReturnType<typeof makeRbac>;
  let service: SubmissionsService;

  beforeEach(() => {
    prisma = makePrisma();
    rbac = makeRbac();
    service = new SubmissionsService(
      prisma as unknown as PrismaService,
      rbac as unknown as RbacService,
    );
  });

  describe('saveDraft', () => {
    it('404 khi bài tập không tồn tại', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);
      await expect(
        service.saveDraft('ghost', 'student-1', { classId: 'c1', contentText: 'Text' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 khi không phải học viên active', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1' });
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(
        service.saveDraft('a1', 'student-1', { classId: 'c1', contentText: 'Text' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('400 khi bài tập không thuộc khóa học của lớp', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue(null);
      await expect(
        service.saveDraft('a1', 'student-1', { classId: 'c1', contentText: 'Text' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('403 khi lessonGate chưa active', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1', lessonId: 'l1' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: false });
      await expect(
        service.saveDraft('a1', 'student-1', { classId: 'c1', contentText: 'Text' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('400 khi bài nộp đã được chấm', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.submission.findUnique.mockResolvedValue(sampleSubmission({ status: 'graded' }));
      await expect(
        service.saveDraft('a1', 'student-1', { classId: 'c1', contentText: 'Text' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lưu nháp thành công qua upsert', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.submission.findUnique.mockResolvedValue(null);
      prisma.submission.upsert.mockResolvedValue(sampleSubmission());

      const res = await service.saveDraft('a1', 'student-1', {
        classId: 'class-1',
        contentText: 'Nội dung bài làm',
      });
      expect(res.status).toBe('draft');
      expect(res.email).toBe('student1@codespace.vn');
    });
  });

  describe('submit', () => {
    it('400 khi quá hạn nộp bài và allowLate=false', async () => {
      prisma.assignment.findUnique.mockResolvedValue({
        id: 'a1',
        courseId: 'crs1',
        dueAt: new Date('2020-01-01'),
        allowLate: false,
      });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });

      await expect(
        service.submit('a1', 'student-1', { classId: 'class-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 khi chưa có nội dung bài nộp', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.submission.findUnique.mockResolvedValue(
        sampleSubmission({ contentText: null, linkUrl: null, fileId: null }),
      );

      await expect(
        service.submit('a1', 'student-1', { classId: 'class-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('nộp bài thành công (chuyển sang submitted)', async () => {
      prisma.assignment.findUnique.mockResolvedValue({ id: 'a1', courseId: 'crs1' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.classCourse.findUnique.mockResolvedValue({ id: 'cc1' });
      prisma.submission.findUnique.mockResolvedValue(sampleSubmission());
      prisma.submission.update.mockResolvedValue(
        sampleSubmission({ status: 'submitted', submittedAt: now }),
      );

      const res = await service.submit('a1', 'student-1', { classId: 'class-1' });
      expect(res.status).toBe('submitted');
      expect(res.submittedAt).toBeTruthy();
    });
  });

  describe('grade', () => {
    it('404 khi bài nộp không tồn tại', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);
      await expect(
        service.grade('sub-ghost', { score: 90 }, { userId: 't1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 khi GV không có grade.write permission cho lớp', async () => {
      prisma.submission.findUnique.mockResolvedValue(sampleSubmission());
      rbac.getEffectivePermissions.mockResolvedValue([]);
      rbac.hasPermission.mockReturnValue(false);

      await expect(
        service.grade('sub-1', { score: 90 }, { userId: 't1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('400 khi điểm chấm vượt quá điểm tối đa', async () => {
      prisma.submission.findUnique.mockResolvedValue(
        sampleSubmission({ assignment: { maxScore: '100' } }),
      );
      rbac.getEffectivePermissions.mockResolvedValue(['grade.write']);
      rbac.hasPermission.mockReturnValue(true);

      await expect(
        service.grade('sub-1', { score: 105 }, { userId: 't1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('chấm bài thành công (cập nhật Decimal score, status graded)', async () => {
      prisma.submission.findUnique.mockResolvedValue(
        sampleSubmission({ assignment: { maxScore: '100' } }),
      );
      rbac.getEffectivePermissions.mockResolvedValue(['grade.write']);
      rbac.hasPermission.mockReturnValue(true);
      prisma.submission.update.mockResolvedValue(
        sampleSubmission({ status: 'graded', score: '95.5', gradedAt: now }),
      );

      const res = await service.grade('sub-1', { score: 95.5, feedbackMd: 'Tốt' }, { userId: 't1' });
      expect(res.status).toBe('graded');
      expect(res.score).toBe(95.5);
    });
  });
});
