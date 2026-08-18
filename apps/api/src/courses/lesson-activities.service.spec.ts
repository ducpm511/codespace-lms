import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LessonActivitiesService } from './lesson-activities.service';
import type { PrismaService } from '../prisma/prisma.service';

const now = new Date('2026-08-18T00:00:00Z');

function activityRow(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    lessonId: 'l1',
    order: 0,
    type: 'markdown',
    title: null,
    contentMd: '# Hi',
    fileId: null,
    videoUrl: null,
    refId: null,
    file: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function makePrisma() {
  return {
    lesson: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    lessonActivity: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
    },
    file: { findUnique: jest.fn() },
    quiz: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    codingProblem: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    assignment: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('LessonActivitiesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: LessonActivitiesService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    // IDOR happy path: lesson thuộc đúng section/course trong path.
    prisma.lesson.findUnique.mockResolvedValue({ sectionId: 's1', section: { courseId: 'c1' } });
    service = new LessonActivitiesService(prisma as unknown as PrismaService);
  });

  describe('IDOR', () => {
    it('404 khi bài học không thuộc section/khóa trong path', async () => {
      prisma.lesson.findUnique.mockResolvedValue({ sectionId: 'other', section: { courseId: 'c1' } });
      await expect(service.list('c1', 's1', 'l1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 khi activity không thuộc bài học', async () => {
      prisma.lessonActivity.findUnique.mockResolvedValue({ id: 'a1', lessonId: 'other' });
      await expect(service.remove('c1', 's1', 'l1', 'a1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.lessonActivity.delete).not.toHaveBeenCalled();
    });
  });

  describe('create — validate theo loại', () => {
    it('markdown rỗng bị từ chối', async () => {
      await expect(
        service.create('c1', 's1', 'l1', { type: 'markdown', contentMd: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lessonActivity.create).not.toHaveBeenCalled();
    });

    it('video ngoài allowlist bị từ chối (INVARIANT nhúng iframe)', async () => {
      await expect(
        service.create('c1', 's1', 'l1', { type: 'video', videoUrl: 'https://evil.example.com/x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lessonActivity.create).not.toHaveBeenCalled();
    });

    it('video host giả mạo tiền tố allowlist bị từ chối', async () => {
      await expect(
        service.create('c1', 's1', 'l1', { type: 'video', videoUrl: 'https://evil-youtube.com/embed/1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('video YouTube hợp lệ được lưu, các cột khác về null', async () => {
      await service.create('c1', 's1', 'l1', {
        type: 'video',
        videoUrl: 'https://www.youtube.com/embed/abc',
        contentMd: 'rác chéo loại',
      });
      expect(prisma.lessonActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lessonId: 'l1',
          order: 0,
          type: 'video',
          videoUrl: 'https://www.youtube.com/embed/abc',
          contentMd: null,
          fileId: null,
          refId: null,
        }),
      });
    });

    it('pdf phải trỏ tới File có mime application/pdf', async () => {
      prisma.file.findUnique.mockResolvedValue({ id: 'f1', mime: 'image/png' });
      await expect(
        service.create('c1', 's1', 'l1', { type: 'pdf', fileId: 'f1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ref phải thuộc đúng khóa học (chống gắn chéo khóa)', async () => {
      prisma.quiz.findUnique.mockResolvedValue({ id: 'q1', courseId: 'OTHER', title: 'Q' });
      await expect(
        service.create('c1', 's1', 'l1', { type: 'quiz', refId: 'q1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gắn quiz vào bài học sẽ set Quiz.lessonId để luật gate áp đúng bài', async () => {
      prisma.quiz.findUnique.mockResolvedValue({ id: 'q1', courseId: 'c1', title: 'Q' });
      await service.create('c1', 's1', 'l1', { type: 'quiz', refId: 'q1' });
      expect(prisma.quiz.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { lessonId: 'l1' } });
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      prisma.lessonActivity.findMany.mockResolvedValue([
        activityRow({ id: 'a1', order: 0 }),
        activityRow({ id: 'a2', order: 1 }),
      ]);
    });

    it('từ chối danh sách thiếu/thừa/trùng id', async () => {
      await expect(
        service.reorder('c1', 's1', 'l1', { activityIds: ['a1'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.reorder('c1', 's1', 'l1', { activityIds: ['a1', 'a1'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.reorder('c1', 's1', 'l1', { activityIds: ['a1', 'ghost'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lessonActivity.update).not.toHaveBeenCalled();
    });

    it('dời qua dải âm trước rồi mới set thứ tự cuối (tránh đụng @@unique)', async () => {
      await service.reorder('c1', 's1', 'l1', { activityIds: ['a2', 'a1'] });
      const orders = prisma.lessonActivity.update.mock.calls.map(
        (c) => [c[0].where.id, c[0].data.order] as const,
      );
      expect(orders).toEqual([
        ['a2', -1],
        ['a1', -2],
        ['a2', 0],
        ['a1', 1],
      ]);
    });
  });

  describe('listForStudent', () => {
    it('quiz CHƯA publish: refId/refTitle về null, refAvailable=false (không lộ đề nháp)', async () => {
      prisma.lessonActivity.findMany.mockResolvedValue([
        activityRow({ id: 'a1', type: 'quiz', contentMd: null, refId: 'q-draft' }),
        activityRow({ id: 'a2', type: 'quiz', order: 1, contentMd: null, refId: 'q-live' }),
      ]);
      prisma.quiz.findMany.mockResolvedValue([
        { id: 'q-draft', title: 'Nháp', published: false },
        { id: 'q-live', title: 'Bài kiểm tra 1', published: true },
      ]);

      const map = await service.listForStudent(['l1']);
      const [draft, live] = map.get('l1') ?? [];

      expect(draft).toMatchObject({ refAvailable: false, refId: null, refTitle: null });
      expect(live).toMatchObject({ refAvailable: true, refId: 'q-live', refTitle: 'Bài kiểm tra 1' });
    });

    it('markdown/pdf/video trả payload trực tiếp, nhóm theo lessonId', async () => {
      prisma.lessonActivity.findMany.mockResolvedValue([
        activityRow({ id: 'a1', lessonId: 'l1' }),
        activityRow({
          id: 'a2',
          lessonId: 'l2',
          type: 'pdf',
          contentMd: null,
          fileId: 'f1',
          file: { id: 'f1', fileName: 'slide.pdf', sizeBytes: 1234 },
        }),
      ]);

      const map = await service.listForStudent(['l1', 'l2']);

      expect(map.get('l1')?.[0]).toMatchObject({ type: 'markdown', contentMd: '# Hi', refAvailable: true });
      expect(map.get('l2')?.[0]).toMatchObject({ type: 'pdf', fileId: 'f1', fileName: 'slide.pdf', fileSizeBytes: 1234 });
    });

    it('không truy vấn gì khi không có bài nào mở gate', async () => {
      const map = await service.listForStudent([]);
      expect(map.size).toBe(0);
      expect(prisma.lessonActivity.findMany).not.toHaveBeenCalled();
    });
  });
});
