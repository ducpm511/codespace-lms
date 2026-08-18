import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import type { CourseDetail, CourseStatusValue, CourseSummary, Paginated } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';
import type { CreateSectionDto } from './dto/create-section.dto';
import type { UpdateSectionDto } from './dto/update-section.dto';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';

const detailInclude = {
  sections: {
    orderBy: { order: 'asc' },
    include: {
      // `_count.activities` chỉ là badge số lượng — nội dung activity lấy qua LessonDetail (P7).
      lessons: { orderBy: { order: 'asc' }, include: { _count: { select: { activities: true } } } },
    },
  },
} satisfies Prisma.CourseInclude;
type CourseWithDetail = Prisma.CourseGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number): Promise<Paginated<CourseSummary>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count(),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  async create(dto: CreateCourseDto, createdById: string): Promise<CourseDetail> {
    const existing = await this.prisma.course.findUnique({ where: { slug: dto.slug }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Slug đã tồn tại');
    }
    const course = await this.prisma.course.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        language: dto.language,
        level: dto.level,
        createdById,
      },
      include: detailInclude,
    });
    return toDetail(course);
  }

  async findOne(id: string): Promise<CourseDetail> {
    const course = await this.prisma.course.findUnique({ where: { id }, include: detailInclude });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }
    return toDetail(course);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseDetail> {
    await this.ensureCourse(id);
    await this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        thumbnailUrl: dto.thumbnailUrl,
        language: dto.language,
        level: dto.level,
      },
    });
    return this.findOne(id);
  }

  /** publish/archive — chỉ đổi status (không đụng nội dung). */
  async setStatus(id: string, status: CourseStatusValue): Promise<CourseDetail> {
    await this.ensureCourse(id);
    await this.prisma.course.update({ where: { id }, data: { status } });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.ensureCourse(id);
    try {
      await this.prisma.course.delete({ where: { id } });
    } catch (e) {
      if (isPrismaError(e, 'P2003')) {
        throw new ConflictException('Khóa học đang được gán cho lớp — gỡ khỏi lớp trước khi xóa');
      }
      throw e;
    }
  }

  // --- Section ---

  async addSection(courseId: string, dto: CreateSectionDto): Promise<CourseDetail> {
    await this.ensureCourse(courseId);
    const order = dto.order ?? (await this.nextSectionOrder(courseId));
    try {
      await this.prisma.section.create({ data: { courseId, title: dto.title, order } });
    } catch (e) {
      throwIfDuplicateOrder(e, order);
    }
    return this.findOne(courseId);
  }

  async updateSection(courseId: string, sectionId: string, dto: UpdateSectionDto): Promise<CourseDetail> {
    await this.ensureSection(courseId, sectionId);
    try {
      await this.prisma.section.update({ where: { id: sectionId }, data: { title: dto.title, order: dto.order } });
    } catch (e) {
      throwIfDuplicateOrder(e, dto.order);
    }
    return this.findOne(courseId);
  }

  async removeSection(courseId: string, sectionId: string): Promise<CourseDetail> {
    await this.ensureSection(courseId, sectionId);
    await this.prisma.section.delete({ where: { id: sectionId } });
    return this.findOne(courseId);
  }

  // --- Lesson ---

  async addLesson(courseId: string, sectionId: string, dto: CreateLessonDto): Promise<CourseDetail> {
    await this.ensureSection(courseId, sectionId);
    const order = dto.order ?? (await this.nextLessonOrder(sectionId));
    try {
      await this.prisma.lesson.create({
        data: {
          sectionId,
          title: dto.title,
          order,
          type: dto.type,
          contentMd: dto.contentMd,
          videoUrl: dto.videoUrl,
          estimatedMinutes: dto.estimatedMinutes,
        },
      });
    } catch (e) {
      throwIfDuplicateOrder(e, order);
    }
    return this.findOne(courseId);
  }

  async updateLesson(
    courseId: string,
    sectionId: string,
    lessonId: string,
    dto: UpdateLessonDto,
  ): Promise<CourseDetail> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    try {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          title: dto.title,
          order: dto.order,
          type: dto.type,
          contentMd: dto.contentMd,
          videoUrl: dto.videoUrl,
          estimatedMinutes: dto.estimatedMinutes,
        },
      });
    } catch (e) {
      throwIfDuplicateOrder(e, dto.order);
    }
    return this.findOne(courseId);
  }

  async removeLesson(courseId: string, sectionId: string, lessonId: string): Promise<CourseDetail> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return this.findOne(courseId);
  }

  // --- helpers (IDOR: mọi thao tác con phải thuộc đúng course/section trong path) ---

  private async ensureCourse(id: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }
  }

  private async ensureSection(courseId: string, sectionId: string): Promise<void> {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId }, select: { courseId: true } });
    if (!section || section.courseId !== courseId) {
      throw new NotFoundException('Section không thuộc khóa học này');
    }
  }

  private async ensureLesson(courseId: string, sectionId: string, lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { sectionId: true, section: { select: { courseId: true } } },
    });
    if (!lesson || lesson.sectionId !== sectionId || lesson.section.courseId !== courseId) {
      throw new NotFoundException('Bài học không thuộc section/khóa học này');
    }
  }

  private async nextSectionOrder(courseId: string): Promise<number> {
    const agg = await this.prisma.section.aggregate({ where: { courseId }, _max: { order: true } });
    return (agg._max.order ?? -1) + 1;
  }

  private async nextLessonOrder(sectionId: string): Promise<number> {
    const agg = await this.prisma.lesson.aggregate({ where: { sectionId }, _max: { order: true } });
    return (agg._max.order ?? -1) + 1;
  }
}

// --- prisma error helpers ---

function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}

function throwIfDuplicateOrder(e: unknown, order: number | undefined): never {
  if (isPrismaError(e, 'P2002')) {
    throw new ConflictException(`Thứ tự (order) đã tồn tại: ${order}`);
  }
  throw e;
}

// --- mappers (chỉ field cần cho client — không lộ createdById/nội bộ) ---

function toSummary(course: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  language: string;
  level: string;
  status: string;
  createdAt: Date;
}): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    language: course.language,
    level: course.level,
    status: course.status,
    createdAt: course.createdAt.toISOString(),
  };
}

function toDetail(course: CourseWithDetail): CourseDetail {
  return {
    ...toSummary(course),
    sections: course.sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        order: lesson.order,
        type: lesson.type,
        estimatedMinutes: lesson.estimatedMinutes,
        activityCount: lesson._count.activities,
      })),
    })),
  };
}
