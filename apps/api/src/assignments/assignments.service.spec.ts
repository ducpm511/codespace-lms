import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    assignment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    course: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const now = new Date('2026-08-13T00:00:00.000Z');

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    courseId: 'c1',
    lessonId: null,
    title: 'BT1',
    descriptionMd: null,
    dueAt: null,
    maxScore: '100', // Prisma Decimal serialize dạng string
    allowLate: false,
    submissionType: 'text',
    createdAt: now,
    ...over,
  };
}

describe('AssignmentsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: AssignmentsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AssignmentsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('404 khi course không tồn tại', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(service.create({ courseId: 'ghost', title: 'X' }, 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('400 khi lessonId không thuộc course', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.lesson.findUnique.mockResolvedValue({ section: { courseId: 'other' } });
      await expect(
        service.create({ courseId: 'c1', lessonId: 'l1', title: 'X' }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gắn createdById + map maxScore Decimal→number, không lộ createdById', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.assignment.create.mockResolvedValue(row());
      const res = await service.create({ courseId: 'c1', title: 'BT1' }, 'teacher-1');
      expect(prisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ createdById: 'teacher-1' }) }),
      );
      expect(res.maxScore).toBe(100);
      expect(typeof res.maxScore).toBe('number');
      expect(res).not.toHaveProperty('createdById');
    });
  });

  describe('findOne', () => {
    it('404 khi không tồn tại', async () => {
      prisma.assignment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('lọc theo courseId khi truyền', async () => {
      prisma.assignment.findMany.mockResolvedValue([row()]);
      prisma.assignment.count.mockResolvedValue(1);
      await service.list('c1', 1, 20);
      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { courseId: 'c1' } }),
      );
    });
  });
});
