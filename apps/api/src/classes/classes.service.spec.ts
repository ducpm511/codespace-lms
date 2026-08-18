import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { LessonActivitiesService } from '../courses/lesson-activities.service';

function makePrisma() {
  const p: Record<string, unknown> = {
    class: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    classCourse: { create: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn() },
    classMember: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn(), updateMany: jest.fn() },
    course: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    lessonGate: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    lessonProgress: { findMany: jest.fn(), upsert: jest.fn() },
    notification: { create: jest.fn() },
  };
  p.$transaction = jest.fn((arg: unknown): unknown => {
    if (typeof arg === 'function') {
      return (arg as (client: unknown) => unknown)(p);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return p as unknown as {
    class: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    classCourse: { create: jest.Mock; deleteMany: jest.Mock; findFirst: jest.Mock };
    classMember: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock; updateMany: jest.Mock };
    course: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    lesson: { findUnique: jest.Mock };
    lessonGate: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
    lessonProgress: { findMany: jest.Mock; upsert: jest.Mock };
    notification: { create: jest.Mock };
    $transaction: jest.Mock;
  };
}

const now = new Date('2026-08-13T00:00:00.000Z');

function classRow(over: Record<string, unknown> = {}) {
  return {
    id: 'cl1',
    name: 'Lớp Python',
    code: 'PY-01',
    description: null,
    status: 'planning',
    startDate: null,
    endDate: null,
    createdAt: now,
    courses: [],
    members: [],
    ...over,
  };
}

describe('ClassesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let lessonActivities: { listForStudent: jest.Mock };
  let service: ClassesService;

  beforeEach(() => {
    prisma = makePrisma();
    lessonActivities = { listForStudent: jest.fn().mockResolvedValue(new Map()) };
    service = new ClassesService(
      prisma as unknown as PrismaService,
      lessonActivities as unknown as LessonActivitiesService,
    );
  });

  describe('create', () => {
    it('409 khi mã lớp trùng', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'exists' });
      await expect(service.create({ name: 'X', code: 'PY-01' }, 'u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('gắn createdById + map detail, không lộ createdById', async () => {
      prisma.class.findUnique.mockResolvedValue(null);
      prisma.class.create.mockResolvedValue(classRow());
      const res = await service.create({ name: 'Lớp Python', code: 'PY-01' }, 'teacher-1');
      expect(prisma.class.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: 'teacher-1' }) }),
      );
      expect(res).not.toHaveProperty('createdById');
      expect(res.courses).toEqual([]);
      expect(res.members).toEqual([]);
    });
  });

  describe('listMine', () => {
    it('trả các lớp user đang là thành viên active', async () => {
      prisma.classMember.findMany.mockResolvedValue([{ class: classRow() }]);
      const res = await service.listMine('u1');
      expect(prisma.classMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', status: 'active' } }),
      );
      expect(res[0].code).toBe('PY-01');
    });
  });

  describe('assignCourse', () => {
    it('404 khi course không tồn tại', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1' });
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.assignCourse('cl1', { courseId: 'ghost' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setGate (integrity + audit)', () => {
    it('400 khi bài không thuộc khóa đã gán cho lớp', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1' });
      prisma.lesson.findUnique.mockResolvedValue({ section: { courseId: 'c9' } });
      prisma.classCourse.findFirst.mockResolvedValue(null); // khóa c9 chưa gán
      await expect(
        service.setGate('cl1', { lessonId: 'l1', isActive: true }, 'teacher-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('mở gate: ghi activatedAt + activatedById cùng lúc', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1' });
      prisma.lesson.findUnique.mockResolvedValue({ section: { courseId: 'c1' } });
      prisma.classCourse.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.lessonGate.upsert.mockResolvedValue({ lessonId: 'l1', isActive: true, activatedAt: now });
      await service.setGate('cl1', { lessonId: 'l1', isActive: true }, 'teacher-1');
      const arg = prisma.lessonGate.upsert.mock.calls[0][0];
      expect(arg.create.activatedById).toBe('teacher-1');
      expect(arg.create.activatedAt).toBeInstanceOf(Date);
      expect(arg.update.activatedById).toBe('teacher-1');
    });

    it('tắt gate: activatedAt/activatedById = null', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1' });
      prisma.lesson.findUnique.mockResolvedValue({ section: { courseId: 'c1' } });
      prisma.classCourse.findFirst.mockResolvedValue({ id: 'cc1' });
      prisma.lessonGate.upsert.mockResolvedValue({ lessonId: 'l1', isActive: false, activatedAt: null });
      await service.setGate('cl1', { lessonId: 'l1', isActive: false }, 'teacher-1');
      const arg = prisma.lessonGate.upsert.mock.calls[0][0];
      expect(arg.update.activatedById).toBeNull();
      expect(arg.update.activatedAt).toBeNull();
    });
  });

  describe('updateMyProgress (INVARIANT #3 + ownership)', () => {
    it('403 khi không phải thành viên active của lớp', async () => {
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMyProgress('cl1', 'l1', 'u1', { status: 'in_progress' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 khi lớp chưa mở gate cho bài (invariant domain)', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: false });
      await expect(
        service.updateMyProgress('cl1', 'l1', 'u1', { status: 'in_progress' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
    });

    it('completed → set completedAt; gate active + là thành viên', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: true });
      prisma.lessonProgress.upsert.mockResolvedValue({ lessonId: 'l1', status: 'completed', completedAt: now });
      const res = await service.updateMyProgress('cl1', 'l1', 'u1', { status: 'completed' });
      const arg = prisma.lessonProgress.upsert.mock.calls[0][0];
      expect(arg.create.completedAt).toBeInstanceOf(Date);
      expect(res.status).toBe('completed');
    });

    it('not_started/in_progress → completedAt = null', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.lessonGate.findUnique.mockResolvedValue({ isActive: true });
      prisma.lessonProgress.upsert.mockResolvedValue({ lessonId: 'l1', status: 'in_progress', completedAt: null });
      await service.updateMyProgress('cl1', 'l1', 'u1', { status: 'in_progress' });
      const arg = prisma.lessonProgress.upsert.mock.calls[0][0];
      expect(arg.update.completedAt).toBeNull();
    });
  });

  describe('getMyLessons (chỉ bài đã gate + invariant)', () => {
    it('403 khi không phải thành viên active', async () => {
      prisma.classMember.findUnique.mockResolvedValue(null);
      await expect(service.getMyLessons('cl1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rỗng khi lớp chưa mở gate nào', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.lessonGate.findMany.mockResolvedValue([]);
      const res = await service.getMyLessons('cl1', 'u1');
      expect(res).toEqual([]);
      expect(prisma.lessonProgress.findMany).not.toHaveBeenCalled();
    });

    it('trả bài đã gate + progress (mặc định not_started), sort theo section/lesson', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.lessonGate.findMany.mockResolvedValue([
        { lessonId: 'l2', lesson: { id: 'l2', title: 'B', type: 'article', order: 1, contentMd: null, videoUrl: null, section: { title: 'S1', order: 0, course: { title: 'C' } } } },
        { lessonId: 'l1', lesson: { id: 'l1', title: 'A', type: 'video', order: 0, contentMd: null, videoUrl: null, section: { title: 'S1', order: 0, course: { title: 'C' } } } },
      ]);
      prisma.lessonProgress.findMany.mockResolvedValue([
        { lessonId: 'l1', status: 'completed', completedAt: now },
      ]);
      const res = await service.getMyLessons('cl1', 'u1');
      expect(res.map((x) => x.lessonId)).toEqual(['l1', 'l2']); // sort theo order
      expect(res[0]).toEqual({
        lessonId: 'l1', title: 'A', type: 'video', courseTitle: 'C', sectionTitle: 'S1',
        progressStatus: 'completed', completedAt: now.toISOString(),
        activities: [], contentMd: null, videoUrl: null,
      });
      expect(res[1].progressStatus).toBe('not_started');
      expect(res[1].completedAt).toBeNull();
      expect(res[0]).not.toHaveProperty('_sort');
    });

    it('P7: chỉ nạp activity của bài ĐÃ mở gate (INVARIANT #3) và gắn đúng bài', async () => {
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active' });
      prisma.lessonGate.findMany.mockResolvedValue([
        { lessonId: 'l1', lesson: { id: 'l1', title: 'A', type: 'article', order: 0, contentMd: 'legacy', videoUrl: null, section: { title: 'S1', order: 0, course: { title: 'C' } } } },
      ]);
      prisma.lessonProgress.findMany.mockResolvedValue([]);
      lessonActivities.listForStudent.mockResolvedValue(
        new Map([['l1', [{ id: 'a1', lessonId: 'l1', order: 0, type: 'markdown', contentMd: '# Hi' }]]]),
      );

      const res = await service.getMyLessons('cl1', 'u1');

      expect(lessonActivities.listForStudent).toHaveBeenCalledWith(['l1']);
      expect(res[0].activities).toEqual([
        { id: 'a1', lessonId: 'l1', order: 0, type: 'markdown', contentMd: '# Hi' },
      ]);
      expect(res[0].contentMd).toBe('legacy'); // fallback bài cũ trước P7
    });
  });

  describe('removeMember (soft remove)', () => {
    it('404 khi thành viên không thuộc lớp', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1' });
      prisma.classMember.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.removeMember('cl1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('set status=removed (không hard-delete)', async () => {
      prisma.class.findUnique
        .mockResolvedValueOnce({ id: 'cl1' }) // ensureClass
        .mockResolvedValueOnce(classRow()); // findOne
      prisma.classMember.updateMany.mockResolvedValue({ count: 1 });
      await service.removeMember('cl1', 'u1');
      expect(prisma.classMember.updateMany).toHaveBeenCalledWith({
        where: { classId: 'cl1', userId: 'u1' },
        data: { status: 'removed' },
      });
    });
  });
});
