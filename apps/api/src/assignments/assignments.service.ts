import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { SCRATCH_CHECK_KEYS, SCRATCH_CHECKS_WITH_MIN } from '@lms/contracts';
import type { AssignmentDetail, AssignmentSummary, Paginated, ScratchCheck } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(courseId: string | undefined, page: number, pageSize: number): Promise<Paginated<AssignmentSummary>> {
    const where = courseId ? { courseId } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.assignment.count({ where }),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  /**
   * Student surface (P7) — bài tập của lớp: chỉ khóa đã gán cho lớp và bài tập KHÔNG gắn lesson
   * hoặc gắn lesson ĐÃ mở gate (INVARIANT #3). Mirror `CodingService.listForClass` / quiz `for-class`.
   * Không dùng `assignment.read` (student không có quyền này) — quyền = thành viên active của lớp.
   */
  async listForClass(classId: string, userId: string): Promise<AssignmentDetail[]> {
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không phải thành viên của lớp này');
    }

    const classCourses = await this.prisma.classCourse.findMany({ where: { classId }, select: { courseId: true } });
    const courseIds = classCourses.map((c) => c.courseId);
    if (courseIds.length === 0) {
      return [];
    }

    const [rows, gates] = await this.prisma.$transaction([
      this.prisma.assignment.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lessonGate.findMany({ where: { classId, isActive: true }, select: { lessonId: true } }),
    ]);

    const openLessons = new Set(gates.map((g) => g.lessonId));
    // `toDetail` chứ không phải `toSummary`: học viên cần ĐỌC ĐƯỢC ĐỀ BÀI. `AssignmentSummary`
    // không mang `descriptionMd` nên trước đây giáo viên soạn đề xong không ai thấy. Đây là đường
    // duy nhất học viên lấy được bài tập — `GET /assignments/:id` đòi `assignment.read`, quyền mà
    // học viên không có.
    return rows.filter((a) => a.lessonId === null || openLessons.has(a.lessonId)).map(toDetail);
  }

  async create(dto: CreateAssignmentDto, createdById: string): Promise<AssignmentDetail> {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { id: true } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }
    if (dto.lessonId) {
      await this.ensureLessonInCourse(dto.lessonId, dto.courseId);
    }
    const created = await this.prisma.assignment.create({
      data: {
        courseId: dto.courseId,
        lessonId: dto.lessonId,
        title: dto.title,
        descriptionMd: dto.descriptionMd,
        dueAt: toDate(dto.dueAt),
        maxScore: dto.maxScore,
        allowLate: dto.allowLate,
        submissionType: dto.submissionType,
        scratchChecks: scratchChecksData(dto.submissionType ?? 'text', dto.scratchChecks),
        createdById,
      },
    });
    return toDetail(created);
  }

  async findOne(id: string): Promise<AssignmentDetail> {
    const assignment = await this.prisma.assignment.findUnique({ where: { id } });
    if (!assignment) {
      throw new NotFoundException('Bài tập không tồn tại');
    }
    return toDetail(assignment);
  }

  async update(id: string, dto: UpdateAssignmentDto): Promise<AssignmentDetail> {
    const current = await this.prisma.assignment.findUnique({
      where: { id },
      select: { submissionType: true, scratchChecks: true },
    });
    if (!current) {
      throw new NotFoundException('Bài tập không tồn tại');
    }
    const type = dto.submissionType ?? current.submissionType;
    // Đổi sang loại khác ⇒ bỏ tiêu chí; không gửi tiêu chí ⇒ giữ tiêu chí cũ (nếu vẫn là scratch).
    const checks =
      dto.scratchChecks !== undefined || type !== 'scratch'
        ? scratchChecksData(type, dto.scratchChecks ?? undefined)
        : undefined;
    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        title: dto.title,
        descriptionMd: dto.descriptionMd,
        dueAt: dto.dueAt === undefined ? undefined : toDate(dto.dueAt),
        maxScore: dto.maxScore,
        allowLate: dto.allowLate,
        submissionType: dto.submissionType,
        scratchChecks: checks,
      },
    });
    return toDetail(updated);
  }

  async remove(id: string): Promise<void> {
    await this.ensureAssignment(id);
    // Cascade xóa Submission theo FK — chấp nhận ở P2 (chưa có GradeEntry/Certificate ràng buộc).
    await this.prisma.assignment.delete({ where: { id } });
  }

  private async ensureAssignment(id: string): Promise<void> {
    const a = await this.prisma.assignment.findUnique({ where: { id }, select: { id: true } });
    if (!a) {
      throw new NotFoundException('Bài tập không tồn tại');
    }
  }

  private async ensureLessonInCourse(lessonId: string, courseId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
    if (!lesson || lesson.section.courseId !== courseId) {
      throw new BadRequestException('Bài học không thuộc khóa học này');
    }
  }
}

/**
 * Tiêu chí gợi ý BlockSpace: chỉ cho bài nộp `scratch` (khác ⇒ DB NULL). Bỏ trùng khóa, giữ thứ tự allowlist;
 * `min` chỉ cho tiêu chí cần ngưỡng (mặc định 2), tiêu chí khác bỏ `min`.
 */
export function normalizeScratchChecks(checks: ScratchCheck[] | undefined): ScratchCheck[] {
  const byKey = new Map((checks ?? []).map((c) => [c.key, c]));
  return SCRATCH_CHECK_KEYS.filter((k) => byKey.has(k)).map((key) =>
    SCRATCH_CHECKS_WITH_MIN.includes(key) ? { key, min: byKey.get(key)?.min ?? 2 } : { key },
  );
}

function scratchChecksData(
  submissionType: string,
  checks: ScratchCheck[] | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (submissionType !== 'scratch') return Prisma.DbNull;
  return normalizeScratchChecks(checks) as unknown as Prisma.InputJsonValue;
}

function toDate(iso: string | null | undefined): Date | null | undefined {
  if (iso === undefined) return undefined;
  if (iso === null) return null;
  return new Date(iso);
}

// --- mappers (điểm Decimal → number; không lộ createdById) ---

type AssignmentRow = {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  descriptionMd: string | null;
  dueAt: Date | null;
  maxScore: unknown; // Prisma.Decimal
  allowLate: boolean;
  submissionType: string;
  scratchChecks?: Prisma.JsonValue;
  createdAt: Date;
};

function toSummary(a: AssignmentRow): AssignmentSummary {
  return {
    id: a.id,
    courseId: a.courseId,
    lessonId: a.lessonId,
    title: a.title,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    maxScore: Number(a.maxScore),
    allowLate: a.allowLate,
    submissionType: a.submissionType,
    scratchChecks: a.submissionType === 'scratch' ? ((a.scratchChecks as ScratchCheck[] | null) ?? []) : null,
    createdAt: a.createdAt.toISOString(),
  };
}

function toDetail(a: AssignmentRow): AssignmentDetail {
  return { ...toSummary(a), descriptionMd: a.descriptionMd };
}
