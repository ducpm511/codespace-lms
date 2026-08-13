import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import type {
  ClassDetail,
  ClassSummary,
  LessonGateDto,
  LessonProgressDto,
  MyLessonDto,
  Paginated,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateClassDto } from './dto/create-class.dto';
import type { UpdateClassDto } from './dto/update-class.dto';
import type { AssignCourseDto } from './dto/assign-course.dto';
import type { EnrollMemberDto } from './dto/enroll-member.dto';
import type { SetLessonGateDto } from './dto/set-lesson-gate.dto';
import type { UpdateProgressDto } from './dto/update-progress.dto';

const detailInclude = {
  courses: {
    orderBy: { order: 'asc' },
    include: { course: { select: { id: true, slug: true, title: true } } },
  },
  members: {
    where: { status: 'active' },
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  },
} satisfies Prisma.ClassInclude;
type ClassWithDetail = Prisma.ClassGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Class CRUD ---

  async list(page: number, pageSize: number): Promise<Paginated<ClassSummary>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.class.count(),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  /** Lớp mà user là thành viên đang hoạt động (Teach/Learn — không cần permission global). */
  async listMine(userId: string): Promise<ClassSummary[]> {
    const members = await this.prisma.classMember.findMany({
      where: { userId, status: 'active' },
      orderBy: { joinedAt: 'desc' },
      include: { class: true },
    });
    return members.map((m) => toSummary(m.class));
  }

  async create(dto: CreateClassDto, createdById: string): Promise<ClassDetail> {
    const existing = await this.prisma.class.findUnique({ where: { code: dto.code }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Mã lớp đã tồn tại');
    }
    const created = await this.prisma.class.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        startDate: toDate(dto.startDate),
        endDate: toDate(dto.endDate),
        createdById,
      },
      include: detailInclude,
    });
    return toDetail(created);
  }

  async findOne(classId: string): Promise<ClassDetail> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, include: detailInclude });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }
    return toDetail(cls);
  }

  async update(classId: string, dto: UpdateClassDto): Promise<ClassDetail> {
    await this.ensureClass(classId);
    await this.prisma.class.update({
      where: { id: classId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate === undefined ? undefined : toDate(dto.startDate),
        endDate: dto.endDate === undefined ? undefined : toDate(dto.endDate),
      },
    });
    return this.findOne(classId);
  }

  async remove(classId: string): Promise<void> {
    await this.ensureClass(classId);
    await this.prisma.class.delete({ where: { id: classId } });
  }

  // --- Gán khóa học ---

  async assignCourse(classId: string, dto: AssignCourseDto): Promise<ClassDetail> {
    await this.ensureClass(classId);
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { id: true } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }
    try {
      await this.prisma.classCourse.create({ data: { classId, courseId: dto.courseId, order: dto.order ?? 0 } });
    } catch (e) {
      if (isPrismaError(e, 'P2002')) {
        throw new ConflictException('Khóa học đã được gán cho lớp');
      }
      throw e;
    }
    return this.findOne(classId);
  }

  async removeCourse(classId: string, courseId: string): Promise<ClassDetail> {
    await this.ensureClass(classId);
    const res = await this.prisma.classCourse.deleteMany({ where: { classId, courseId } });
    if (res.count === 0) {
      throw new NotFoundException('Khóa học chưa được gán cho lớp này');
    }
    return this.findOne(classId);
  }

  // --- Thành viên ---

  async enrollMember(classId: string, dto: EnrollMemberDto): Promise<ClassDetail> {
    await this.ensureClass(classId);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    // Idempotent + reactivate nếu từng removed.
    await this.prisma.classMember.upsert({
      where: { classId_userId: { classId, userId: dto.userId } },
      update: { roleInClass: dto.roleInClass, status: 'active' },
      create: { classId, userId: dto.userId, roleInClass: dto.roleInClass ?? 'student' },
    });
    return this.findOne(classId);
  }

  async removeMember(classId: string, userId: string): Promise<ClassDetail> {
    await this.ensureClass(classId);
    const res = await this.prisma.classMember.updateMany({
      where: { classId, userId },
      data: { status: 'removed' },
    });
    if (res.count === 0) {
      throw new NotFoundException('Thành viên không thuộc lớp này');
    }
    return this.findOne(classId);
  }

  // --- Lesson gate (mở bài theo tiến độ lớp) ---

  async listGates(classId: string): Promise<LessonGateDto[]> {
    await this.ensureClass(classId);
    const gates = await this.prisma.lessonGate.findMany({ where: { classId }, orderBy: { createdAt: 'asc' } });
    return gates.map(toGateDto);
  }

  /**
   * Mở/tắt gate cho một bài. Bài phải thuộc khóa đã gán cho lớp (integrity).
   * Khi mở: ghi activatedAt + activatedById cùng lúc (audit trong cùng lần ghi).
   */
  async setGate(classId: string, dto: SetLessonGateDto, activatedById: string): Promise<LessonGateDto> {
    await this.ensureClass(classId);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      select: { section: { select: { courseId: true } } },
    });
    if (!lesson) {
      throw new NotFoundException('Bài học không tồn tại');
    }
    const assigned = await this.prisma.classCourse.findFirst({
      where: { classId, courseId: lesson.section.courseId },
      select: { id: true },
    });
    if (!assigned) {
      throw new BadRequestException('Bài học không thuộc khóa học nào đã gán cho lớp');
    }
    const gate = await this.prisma.lessonGate.upsert({
      where: { classId_lessonId: { classId, lessonId: dto.lessonId } },
      update: {
        isActive: dto.isActive,
        activatedAt: dto.isActive ? new Date() : null,
        activatedById: dto.isActive ? activatedById : null,
      },
      create: {
        classId,
        lessonId: dto.lessonId,
        isActive: dto.isActive,
        activatedAt: dto.isActive ? new Date() : null,
        activatedById: dto.isActive ? activatedById : null,
      },
    });
    return toGateDto(gate);
  }

  // --- Tiến độ học viên (ownership theo membership + invariant gate) ---

  async getMyProgress(classId: string, userId: string): Promise<LessonProgressDto[]> {
    await this.ensureActiveMember(classId, userId);
    const rows = await this.prisma.lessonProgress.findMany({ where: { classId, userId } });
    return rows.map(toProgressDto);
  }

  /**
   * Danh sách bài học viên được phép học trong lớp: CHỈ bài có LessonGate isActive=true
   * (invariant #3 — không lộ bài chưa mở), kèm tiến độ của chính user. Sắp theo course/section/lesson.
   */
  async getMyLessons(classId: string, userId: string): Promise<MyLessonDto[]> {
    await this.ensureActiveMember(classId, userId);
    const gates = await this.prisma.lessonGate.findMany({
      where: { classId, isActive: true },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            order: true,
            section: { select: { title: true, order: true, course: { select: { title: true } } } },
          },
        },
      },
    });
    if (gates.length === 0) {
      return [];
    }
    const progress = await this.prisma.lessonProgress.findMany({
      where: { classId, userId, lessonId: { in: gates.map((g) => g.lessonId) } },
    });
    const byLesson = new Map(progress.map((p) => [p.lessonId, p]));

    return gates
      .map((g) => {
        const p = byLesson.get(g.lessonId);
        return {
          lessonId: g.lessonId,
          title: g.lesson.title,
          type: g.lesson.type,
          courseTitle: g.lesson.section.course.title,
          sectionTitle: g.lesson.section.title,
          progressStatus: p?.status ?? 'not_started',
          completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
          _sort: [g.lesson.section.order, g.lesson.order] as const,
        };
      })
      .sort((a, b) => a._sort[0] - b._sort[0] || a._sort[1] - b._sort[1])
      .map(({ _sort, ...dto }) => dto);
  }

  /**
   * Học viên cập nhật tiến độ bài của CHÍNH mình.
   * INVARIANT #3 (domain): chặn khi lớp chưa có LessonGate isActive=true cho bài đó.
   */
  async updateMyProgress(
    classId: string,
    lessonId: string,
    userId: string,
    dto: UpdateProgressDto,
  ): Promise<LessonProgressDto> {
    await this.ensureActiveMember(classId, userId);
    const gate = await this.prisma.lessonGate.findUnique({
      where: { classId_lessonId: { classId, lessonId } },
      select: { isActive: true },
    });
    if (!gate || !gate.isActive) {
      throw new ForbiddenException('Bài học chưa được mở cho lớp này');
    }
    const completedAt = dto.status === 'completed' ? new Date() : null;
    const row = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId_classId: { userId, lessonId, classId } },
      update: { status: dto.status, completedAt },
      create: { userId, lessonId, classId, status: dto.status, completedAt },
    });
    return toProgressDto(row);
  }

  // --- helpers ---

  private async ensureClass(classId: string): Promise<void> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }
  }

  private async ensureActiveMember(classId: string, userId: string): Promise<void> {
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không thuộc lớp này');
    }
  }
}

// --- prisma error helper ---

function isPrismaError(e: unknown, code: string): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}

function toDate(iso: string | null | undefined): Date | null | undefined {
  if (iso === undefined) return undefined;
  if (iso === null) return null;
  return new Date(iso);
}

// --- mappers (chỉ field cần cho client — không lộ createdById/nội bộ) ---

function toSummary(cls: {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}): ClassSummary {
  return {
    id: cls.id,
    name: cls.name,
    code: cls.code,
    description: cls.description,
    status: cls.status,
    startDate: cls.startDate ? cls.startDate.toISOString() : null,
    endDate: cls.endDate ? cls.endDate.toISOString() : null,
    createdAt: cls.createdAt.toISOString(),
  };
}

function toDetail(cls: ClassWithDetail): ClassDetail {
  return {
    ...toSummary(cls),
    courses: cls.courses.map((cc) => ({
      id: cc.id,
      courseId: cc.courseId,
      title: cc.course.title,
      slug: cc.course.slug,
      order: cc.order,
    })),
    members: cls.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      fullName: m.user.fullName,
      roleInClass: m.roleInClass,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

function toGateDto(gate: { lessonId: string; isActive: boolean; activatedAt: Date | null }): LessonGateDto {
  return {
    lessonId: gate.lessonId,
    isActive: gate.isActive,
    activatedAt: gate.activatedAt ? gate.activatedAt.toISOString() : null,
  };
}

function toProgressDto(row: { lessonId: string; status: string; completedAt: Date | null }): LessonProgressDto {
  return {
    lessonId: row.lessonId,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}
