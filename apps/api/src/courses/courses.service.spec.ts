import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { CoursesService } from './courses.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    course: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    section: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    lesson: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const now = new Date('2026-08-13T00:00:00.000Z');

function courseRow(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    slug: 'python-basics',
    title: 'Python Basics',
    description: null,
    thumbnailUrl: null,
    language: 'python',
    level: 'beginner',
    status: 'draft',
    createdAt: now,
    sections: [],
    ...over,
  };
}

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

describe('CoursesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: CoursesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CoursesService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('map summary + phân trang, không lộ createdById', async () => {
      prisma.course.findMany.mockResolvedValue([courseRow()]);
      prisma.course.count.mockResolvedValue(1);
      const res = await service.list(1, 20);
      expect(res.total).toBe(1);
      expect(res.items[0]).toEqual({
        id: 'c1',
        slug: 'python-basics',
        title: 'Python Basics',
        description: null,
        thumbnailUrl: null,
        language: 'python',
        level: 'beginner',
        status: 'draft',
        createdAt: now.toISOString(),
      });
      expect(res.items[0]).not.toHaveProperty('createdById');
    });
  });

  describe('create', () => {
    it('409 khi slug đã tồn tại', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'exists' });
      await expect(
        service.create({ slug: 'python-basics', title: 'X' }, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.course.create).not.toHaveBeenCalled();
    });

    it('gắn createdById từ current user', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      prisma.course.create.mockResolvedValue(courseRow());
      await service.create({ slug: 'python-basics', title: 'Python Basics' }, 'teacher-1');
      expect(prisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: 'teacher-1' }) }),
      );
    });
  });

  describe('findOne (IDOR)', () => {
    it('404 khi course không tồn tại', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('trả CourseDetail với sections/lessons đã sort-map', async () => {
      prisma.course.findUnique.mockResolvedValue(
        courseRow({
          sections: [
            {
              id: 's1',
              title: 'Intro',
              order: 0,
              lessons: [
                {
                  id: 'l1',
                  title: 'Hello',
                  order: 0,
                  type: 'article',
                  estimatedMinutes: 5,
                  _count: { activities: 2 },
                },
              ],
            },
          ],
        }),
      );
      const res = await service.findOne('c1');
      expect(res.sections).toHaveLength(1);
      expect(res.sections[0].lessons[0]).toEqual({
        id: 'l1',
        title: 'Hello',
        order: 0,
        type: 'article',
        estimatedMinutes: 5,
        activityCount: 2,
      });
    });
  });

  describe('setStatus (publish)', () => {
    it('đổi status=published rồi trả detail', async () => {
      prisma.course.findUnique
        .mockResolvedValueOnce({ id: 'c1' }) // ensureCourse
        .mockResolvedValueOnce(courseRow({ status: 'published' })); // findOne
      prisma.course.update.mockResolvedValue({});
      const res = await service.setStatus('c1', 'published');
      expect(prisma.course.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'published' } });
      expect(res.status).toBe('published');
    });
  });

  describe('remove', () => {
    it('409 khi course đang gán lớp (FK P2003)', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.course.delete.mockRejectedValue(knownError('P2003'));
      await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('addSection', () => {
    it('auto order = max+1 khi không truyền order', async () => {
      prisma.course.findUnique
        .mockResolvedValueOnce({ id: 'c1' }) // ensureCourse
        .mockResolvedValueOnce(courseRow()); // findOne
      prisma.section.aggregate.mockResolvedValue({ _max: { order: 2 } });
      prisma.section.create.mockResolvedValue({});
      await service.addSection('c1', { title: 'New' });
      expect(prisma.section.create).toHaveBeenCalledWith({ data: { courseId: 'c1', title: 'New', order: 3 } });
    });

    it('409 khi order trùng (unique P2002)', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.section.create.mockRejectedValue(knownError('P2002'));
      await expect(service.addSection('c1', { title: 'Dup', order: 0 })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('ensureSection (IDOR)', () => {
    it('404 khi section thuộc course khác', async () => {
      prisma.section.findUnique.mockResolvedValue({ courseId: 'other' });
      await expect(service.removeSection('c1', 's1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.section.delete).not.toHaveBeenCalled();
    });
  });

  describe('ensureLesson (IDOR)', () => {
    it('404 khi lesson không thuộc section/course trong path', async () => {
      prisma.lesson.findUnique.mockResolvedValue({ sectionId: 's-other', section: { courseId: 'c1' } });
      await expect(
        service.removeLesson('c1', 's1', 'l1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.lesson.delete).not.toHaveBeenCalled();
    });
  });
});
