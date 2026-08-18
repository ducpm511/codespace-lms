import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { REF_ACTIVITY_TYPES } from '@lms/contracts';
import type {
  LessonActivityDto,
  LessonActivityTypeValue,
  LessonDetail,
  StudentLessonActivityDto,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { isAllowedVideoUrl } from '../common/video-embed';
import type { CreateLessonActivityDto } from './dto/create-lesson-activity.dto';
import type { UpdateLessonActivityDto } from './dto/update-lesson-activity.dto';
import type { ReorderLessonActivitiesDto } from './dto/reorder-lesson-activities.dto';

const activityInclude = {
  file: { select: { id: true, fileName: true, sizeBytes: true } },
} satisfies Prisma.LessonActivityInclude;
type ActivityWithFile = Prisma.LessonActivityGetPayload<{ include: typeof activityInclude }>;

/** Bảng engine tương ứng từng loại activity ref. */
const REF_MODEL: Record<'quiz' | 'coding' | 'assignment', 'quiz' | 'codingProblem' | 'assignment'> = {
  quiz: 'quiz',
  coding: 'codingProblem',
  assignment: 'assignment',
};

/**
 * P7 — quản lý danh sách activity trong một bài học (author surface).
 * IDOR: mọi thao tác đi qua `ensureLesson(courseId, sectionId, lessonId)` — activity phải thuộc đúng
 * lesson trong path. Quyền `course.update` chấm ở controller.
 */
@Injectable()
export class LessonActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getLessonDetail(courseId: string, sectionId: string, lessonId: string): Promise<LessonDetail> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: { activities: { orderBy: { order: 'asc' }, include: activityInclude } },
    });
    return {
      id: lesson.id,
      sectionId: lesson.sectionId,
      title: lesson.title,
      order: lesson.order,
      type: lesson.type,
      estimatedMinutes: lesson.estimatedMinutes,
      contentMd: lesson.contentMd,
      videoUrl: lesson.videoUrl,
      activityCount: lesson.activities.length,
      activities: await this.toDtos(lesson.activities),
    };
  }

  async list(courseId: string, sectionId: string, lessonId: string): Promise<LessonActivityDto[]> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    return this.listRaw(lessonId);
  }

  async create(
    courseId: string,
    sectionId: string,
    lessonId: string,
    dto: CreateLessonActivityDto,
  ): Promise<LessonActivityDto[]> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    const payload = await this.validatePayload(courseId, dto.type, {
      contentMd: dto.contentMd,
      fileId: dto.fileId,
      videoUrl: dto.videoUrl,
      refId: dto.refId,
    });
    const order = dto.order ?? (await this.nextOrder(lessonId));

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonActivity.create({
        data: { lessonId, order, type: dto.type, title: dto.title ?? null, ...payload },
      });
      // Gắn bài học cho engine ref để luật gate (INVARIANT #3) áp đúng bài này.
      await linkRefToLesson(tx, dto.type, payload.refId ?? null, lessonId);
    });

    return this.listRaw(lessonId);
  }

  async update(
    courseId: string,
    sectionId: string,
    lessonId: string,
    activityId: string,
    dto: UpdateLessonActivityDto,
  ): Promise<LessonActivityDto[]> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    const current = await this.ensureActivity(lessonId, activityId);
    const type = current.type as LessonActivityTypeValue;

    // Field không thuộc loại activity bị bỏ qua (không cho ghi rác chéo loại).
    const merged = {
      contentMd: dto.contentMd === undefined ? current.contentMd : dto.contentMd,
      fileId: dto.fileId === undefined ? current.fileId : dto.fileId,
      videoUrl: dto.videoUrl === undefined ? current.videoUrl : dto.videoUrl,
      refId: dto.refId === undefined ? current.refId : dto.refId,
    };
    const payload = await this.validatePayload(courseId, type, merged);

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonActivity.update({
        where: { id: activityId },
        data: { title: dto.title === undefined ? undefined : dto.title, ...payload },
      });
      await linkRefToLesson(tx, type, payload.refId ?? null, lessonId);
    });

    return this.listRaw(lessonId);
  }

  async remove(
    courseId: string,
    sectionId: string,
    lessonId: string,
    activityId: string,
  ): Promise<LessonActivityDto[]> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    await this.ensureActivity(lessonId, activityId);
    // Chỉ gỡ activity — KHÔNG xoá Quiz/CodingProblem/Assignment hay File đằng sau (không hard-delete dữ liệu).
    await this.prisma.lessonActivity.delete({ where: { id: activityId } });
    return this.listRaw(lessonId);
  }

  /** Sắp xếp lại: nhận ĐỦ id trong bài. Dời qua dải âm trước để không đụng `@@unique([lessonId, order])`. */
  async reorder(
    courseId: string,
    sectionId: string,
    lessonId: string,
    dto: ReorderLessonActivitiesDto,
  ): Promise<LessonActivityDto[]> {
    await this.ensureLesson(courseId, sectionId, lessonId);
    const existing = await this.prisma.lessonActivity.findMany({
      where: { lessonId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((a) => a.id));
    const wanted = dto.activityIds;
    if (wanted.length !== existingIds.size || new Set(wanted).size !== wanted.length) {
      throw new BadRequestException('Danh sách sắp xếp phải chứa đúng một lần mọi activity của bài học');
    }
    for (const id of wanted) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('Activity không thuộc bài học này');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < wanted.length; i++) {
        await tx.lessonActivity.update({ where: { id: wanted[i] }, data: { order: -(i + 1) } });
      }
      for (let i = 0; i < wanted.length; i++) {
        await tx.lessonActivity.update({ where: { id: wanted[i] }, data: { order: i } });
      }
    });

    return this.listRaw(lessonId);
  }

  /**
   * Student surface — nạp activity cho nhiều bài học cùng lúc (dùng ở `GET /classes/:id/my-lessons`).
   * CALLER phải tự chắc bài học đã mở gate cho lớp của học viên (INVARIANT #3).
   *
   * KHÔNG lộ nội dung nhạy cảm: activity ref chỉ trả `refId` + tiêu đề để FE mở workspace engine sẵn có
   * (engine tự enforce membership/gate/không lộ đáp án). Quiz chưa publish coi như CHƯA sẵn sàng —
   * `refId`/`refTitle` về null để học viên không dò được id đề nháp.
   */
  async listForStudent(lessonIds: string[]): Promise<Map<string, StudentLessonActivityDto[]>> {
    const out = new Map<string, StudentLessonActivityDto[]>();
    if (lessonIds.length === 0) {
      return out;
    }
    const rows = await this.prisma.lessonActivity.findMany({
      where: { lessonId: { in: lessonIds } },
      orderBy: [{ lessonId: 'asc' }, { order: 'asc' }],
      include: activityInclude,
    });
    const availability = await this.resolveStudentRefs(rows);

    for (const a of rows) {
      const type = a.type as LessonActivityTypeValue;
      const ref = a.refId ? availability.get(`${a.type}:${a.refId}`) : undefined;
      const available = REF_ACTIVITY_TYPES.includes(type) ? Boolean(ref?.available) : true;
      const dto: StudentLessonActivityDto = {
        id: a.id,
        lessonId: a.lessonId,
        order: a.order,
        type,
        title: a.title,
        contentMd: a.contentMd,
        fileId: a.fileId,
        fileName: a.file?.fileName ?? null,
        fileSizeBytes: a.file?.sizeBytes ?? null,
        videoUrl: a.videoUrl,
        refId: available ? a.refId : null,
        refTitle: available ? (ref?.title ?? null) : null,
        refAvailable: available,
      };
      out.set(a.lessonId, [...(out.get(a.lessonId) ?? []), dto]);
    }
    return out;
  }

  // --- helpers ---

  private async listRaw(lessonId: string): Promise<LessonActivityDto[]> {
    const rows = await this.prisma.lessonActivity.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
      include: activityInclude,
    });
    return this.toDtos(rows);
  }

  /**
   * Mỗi loại chỉ giữ đúng cột của mình (các cột khác về null) + bắt buộc dữ liệu tối thiểu.
   * video: host phải nằm trong allowlist. pdf/ref: bản ghi phải tồn tại và thuộc đúng khóa học.
   */
  private async validatePayload(
    courseId: string,
    type: LessonActivityTypeValue,
    input: { contentMd?: string | null; fileId?: string | null; videoUrl?: string | null; refId?: string | null },
  ): Promise<{ contentMd: string | null; fileId: string | null; videoUrl: string | null; refId: string | null }> {
    const empty = { contentMd: null, fileId: null, videoUrl: null, refId: null };

    if (type === 'markdown') {
      const contentMd = input.contentMd?.trim();
      if (!contentMd) {
        throw new BadRequestException('Nội dung markdown không được để trống');
      }
      return { ...empty, contentMd };
    }

    if (type === 'pdf') {
      if (!input.fileId) {
        throw new BadRequestException('Cần chọn file PDF cho activity này');
      }
      const file = await this.prisma.file.findUnique({
        where: { id: input.fileId },
        select: { id: true, mime: true },
      });
      if (!file) {
        throw new NotFoundException('File không tồn tại');
      }
      if (file.mime !== 'application/pdf') {
        throw new BadRequestException('File đính kèm phải là PDF');
      }
      return { ...empty, fileId: file.id };
    }

    if (type === 'video') {
      const videoUrl = input.videoUrl?.trim();
      if (!videoUrl) {
        throw new BadRequestException('Cần nhập link video');
      }
      if (!isAllowedVideoUrl(videoUrl)) {
        throw new BadRequestException('Chỉ hỗ trợ link nhúng từ YouTube, Vimeo hoặc Google Drive');
      }
      return { ...empty, videoUrl };
    }

    if (!REF_ACTIVITY_TYPES.includes(type)) {
      throw new BadRequestException('Loại activity không hợp lệ');
    }
    if (!input.refId) {
      throw new BadRequestException('Cần chọn bài tập/trắc nghiệm cho activity này');
    }
    const ref = await this.findRef(type as 'quiz' | 'coding' | 'assignment', input.refId);
    if (!ref) {
      throw new NotFoundException('Nội dung được gắn không tồn tại');
    }
    if (ref.courseId !== courseId) {
      throw new BadRequestException('Nội dung được gắn không thuộc khóa học này');
    }
    return { ...empty, refId: input.refId };
  }

  private findRef(
    type: 'quiz' | 'coding' | 'assignment',
    refId: string,
  ): Promise<{ id: string; courseId: string; title: string } | null> {
    const select = { id: true, courseId: true, title: true } as const;
    const where = { id: refId } as const;
    switch (type) {
      case 'quiz':
        return this.prisma.quiz.findUnique({ where, select });
      case 'coding':
        return this.prisma.codingProblem.findUnique({ where, select });
      default:
        return this.prisma.assignment.findUnique({ where, select });
    }
  }

  /** Nạp tiêu đề của Quiz/CodingProblem/Assignment cho các activity ref (chỉ tiêu đề — không nội dung). */
  private async toDtos(rows: ActivityWithFile[]): Promise<LessonActivityDto[]> {
    const titles = await this.resolveRefTitles(rows);
    return rows.map((a) => ({
      id: a.id,
      lessonId: a.lessonId,
      order: a.order,
      type: a.type as LessonActivityTypeValue,
      title: a.title,
      contentMd: a.contentMd,
      fileId: a.fileId,
      fileName: a.file?.fileName ?? null,
      fileSizeBytes: a.file?.sizeBytes ?? null,
      videoUrl: a.videoUrl,
      refId: a.refId,
      refTitle: a.refId ? (titles.get(`${a.type}:${a.refId}`) ?? null) : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  private async resolveRefTitles(
    rows: Array<{ type: string; refId: string | null }>,
  ): Promise<Map<string, string>> {
    const byType = new Map<'quiz' | 'coding' | 'assignment', string[]>();
    for (const row of rows) {
      if (!row.refId || !REF_ACTIVITY_TYPES.includes(row.type as LessonActivityTypeValue)) {
        continue;
      }
      const key = row.type as 'quiz' | 'coding' | 'assignment';
      byType.set(key, [...(byType.get(key) ?? []), row.refId]);
    }

    const out = new Map<string, string>();
    for (const [type, ids] of byType) {
      const model = REF_MODEL[type];
      const found = await (
        this.prisma[model] as {
          findMany: (args: unknown) => Promise<Array<{ id: string; title: string }>>;
        }
      ).findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
      for (const r of found) {
        out.set(`${type}:${r.id}`, r.title);
      }
    }
    return out;
  }

  /** Tiêu đề + trạng thái sẵn sàng của engine ref cho student (quiz phải `published`). */
  private async resolveStudentRefs(
    rows: Array<{ type: string; refId: string | null }>,
  ): Promise<Map<string, { title: string; available: boolean }>> {
    const ids = (type: string): string[] => [
      ...new Set(rows.filter((r) => r.type === type && r.refId).map((r) => r.refId as string)),
    ];
    const out = new Map<string, { title: string; available: boolean }>();

    const quizIds = ids('quiz');
    if (quizIds.length > 0) {
      const quizzes = await this.prisma.quiz.findMany({
        where: { id: { in: quizIds } },
        select: { id: true, title: true, published: true },
      });
      for (const q of quizzes) {
        out.set(`quiz:${q.id}`, { title: q.title, available: q.published });
      }
    }

    const codingIds = ids('coding');
    if (codingIds.length > 0) {
      const problems = await this.prisma.codingProblem.findMany({
        where: { id: { in: codingIds } },
        select: { id: true, title: true },
      });
      for (const p of problems) {
        out.set(`coding:${p.id}`, { title: p.title, available: true });
      }
    }

    const assignmentIds = ids('assignment');
    if (assignmentIds.length > 0) {
      const assignments = await this.prisma.assignment.findMany({
        where: { id: { in: assignmentIds } },
        select: { id: true, title: true },
      });
      for (const a of assignments) {
        out.set(`assignment:${a.id}`, { title: a.title, available: true });
      }
    }

    return out;
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

  private async ensureActivity(lessonId: string, activityId: string) {
    const activity = await this.prisma.lessonActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.lessonId !== lessonId) {
      throw new NotFoundException('Activity không thuộc bài học này');
    }
    return activity;
  }

  private async nextOrder(lessonId: string): Promise<number> {
    const agg = await this.prisma.lessonActivity.aggregate({ where: { lessonId }, _max: { order: true } });
    return (agg._max.order ?? -1) + 1;
  }
}

/**
 * Gắn `lessonId` cho engine được tham chiếu — để `for-class` của quiz/coding và submission gate
 * (INVARIANT #3) tính đúng theo bài học chứa activity. KHÔNG gỡ liên kết khi xoá activity
 * (tránh âm thầm đổi dữ liệu đã dùng ở nơi khác).
 */
async function linkRefToLesson(
  tx: Prisma.TransactionClient,
  type: LessonActivityTypeValue,
  refId: string | null,
  lessonId: string,
): Promise<void> {
  if (!refId) {
    return;
  }
  if (type === 'quiz') {
    await tx.quiz.update({ where: { id: refId }, data: { lessonId } });
  } else if (type === 'coding') {
    await tx.codingProblem.update({ where: { id: refId }, data: { lessonId } });
  } else if (type === 'assignment') {
    await tx.assignment.update({ where: { id: refId }, data: { lessonId } });
  }
}
