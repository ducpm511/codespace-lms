import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import { PERMISSIONS, type Paginated, type SubmissionDto } from '@lms/contracts';
import type { AuthPrincipal } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import type { SaveSubmissionDto } from './dto/save-submission.dto';
import type { SubmitSubmissionDto } from './dto/submit-submission.dto';
import type { GradeSubmissionDto } from './dto/grade-submission.dto';
import type { QuerySubmissionsDto } from './dto/query-submissions.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async saveDraft(
    assignmentId: string,
    userId: string,
    dto: SaveSubmissionDto,
  ): Promise<SubmissionDto> {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      throw new NotFoundException('Bài tập không tồn tại');
    }

    await this.ensureActiveMember(dto.classId, userId);
    await this.ensureCourseInClass(dto.classId, assignment.courseId);
    if (assignment.lessonId) {
      await this.ensureLessonGateActive(dto.classId, assignment.lessonId);
    }

    const existing = await this.prisma.submission.findUnique({
      where: { assignmentId_userId_classId: { assignmentId, userId, classId: dto.classId } },
    });

    if (existing?.status === 'graded') {
      throw new BadRequestException('Bài nộp đã được chấm, không thể sửa');
    }

    const submission = await this.prisma.submission.upsert({
      where: { assignmentId_userId_classId: { assignmentId, userId, classId: dto.classId } },
      create: {
        assignmentId,
        userId,
        classId: dto.classId,
        contentText: dto.contentText ?? null,
        linkUrl: dto.linkUrl ?? null,
        fileId: dto.fileId ?? null,
        status: 'draft',
      },
      update: {
        contentText: dto.contentText !== undefined ? dto.contentText : existing?.contentText,
        linkUrl: dto.linkUrl !== undefined ? dto.linkUrl : existing?.linkUrl,
        fileId: dto.fileId !== undefined ? dto.fileId : existing?.fileId,
        status: existing?.status === 'submitted' ? 'draft' : (existing?.status ?? 'draft'),
      },
      include: { user: { select: { email: true, fullName: true } } },
    });

    return toSubmissionDto(submission);
  }

  async submit(
    assignmentId: string,
    userId: string,
    dto: SubmitSubmissionDto,
  ): Promise<SubmissionDto> {
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      throw new NotFoundException('Bài tập không tồn tại');
    }

    await this.ensureActiveMember(dto.classId, userId);
    await this.ensureCourseInClass(dto.classId, assignment.courseId);
    if (assignment.lessonId) {
      await this.ensureLessonGateActive(dto.classId, assignment.lessonId);
    }

    if (assignment.dueAt && new Date() > assignment.dueAt && !assignment.allowLate) {
      throw new BadRequestException('Bài tập đã hết hạn nộp bài');
    }

    const existing = await this.prisma.submission.findUnique({
      where: { assignmentId_userId_classId: { assignmentId, userId, classId: dto.classId } },
    });

    if (!existing) {
      throw new BadRequestException('Chưa có nội dung nộp bài');
    }

    if (existing.status === 'graded') {
      throw new BadRequestException('Bài nộp đã được chấm');
    }

    if (!existing.contentText && !existing.linkUrl && !existing.fileId) {
      throw new BadRequestException('Chưa có nội dung nộp bài');
    }

    const updated = await this.prisma.submission.update({
      where: { id: existing.id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
      },
      include: { user: { select: { email: true, fullName: true } } },
    });

    return toSubmissionDto(updated);
  }

  async getMySubmission(
    assignmentId: string,
    classId: string,
    userId: string,
  ): Promise<SubmissionDto | null> {
    await this.ensureActiveMember(classId, userId);
    const sub = await this.prisma.submission.findUnique({
      where: { assignmentId_userId_classId: { assignmentId, userId, classId } },
      include: { user: { select: { email: true, fullName: true } } },
    });
    return sub ? toSubmissionDto(sub) : null;
  }

  async listForClassAssignment(
    classId: string,
    assignmentId: string,
    query: QuerySubmissionsDto,
  ): Promise<Paginated<SubmissionDto>> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true },
    });
    if (!assignment) {
      throw new NotFoundException('Bài tập không tồn tại');
    }

    const where: Prisma.SubmissionWhereInput = {
      classId,
      assignmentId,
      ...(query.status ? { status: query.status as Prisma.EnumSubmissionStatusFilter } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { email: true, fullName: true } } },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      items: rows.map(toSubmissionDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findOne(id: string, currentUser: AuthPrincipal): Promise<SubmissionDto> {
    const sub = await this.prisma.submission.findUnique({
      where: { id },
      include: { user: { select: { email: true, fullName: true } } },
    });
    if (!sub) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    if (sub.userId !== currentUser.userId) {
      const eff = await this.rbac.getEffectivePermissions(currentUser.userId);
      const canRead =
        this.rbac.hasPermission(eff, PERMISSIONS.SUBMISSION_READ, sub.classId) ||
        this.rbac.hasPermission(eff, PERMISSIONS.GRADE_WRITE, sub.classId);
      if (!canRead) {
        throw new ForbiddenException('Không có quyền xem bài nộp này');
      }
    }

    return toSubmissionDto(sub);
  }

  async grade(
    id: string,
    dto: GradeSubmissionDto,
    currentUser: AuthPrincipal,
  ): Promise<SubmissionDto> {
    const sub = await this.prisma.submission.findUnique({
      where: { id },
      include: { assignment: { select: { maxScore: true } } },
    });
    if (!sub) {
      throw new NotFoundException('Bài nộp không tồn tại');
    }

    const eff = await this.rbac.getEffectivePermissions(currentUser.userId);
    if (!this.rbac.hasPermission(eff, PERMISSIONS.GRADE_WRITE, sub.classId)) {
      throw new ForbiddenException('Không có quyền chấm bài cho lớp này');
    }

    const maxScore = Number(sub.assignment.maxScore);
    if (dto.score > maxScore) {
      throw new BadRequestException(`Điểm chấm (${dto.score}) vượt quá điểm tối đa (${maxScore})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.submission.update({
        where: { id },
        data: {
          score: new Prisma.Decimal(dto.score),
          feedbackMd: dto.feedbackMd ?? null,
          gradedById: currentUser.userId,
          gradedAt: new Date(),
          status: 'graded',
        },
        include: { user: { select: { email: true, fullName: true } } },
      }),
      this.prisma.notification.create({
        data: {
          userId: sub.userId,
          type: 'submission.graded',
          title: 'Bài tập của bạn đã được chấm điểm! 📝',
          message: `Bài nộp của bạn đã được chấm: ${dto.score}/${maxScore} điểm.`,
          payloadJson: { submissionId: sub.id, score: dto.score, maxScore },
        },
      }),
    ]);

    return toSubmissionDto(updated);
  }

  private async ensureActiveMember(classId: string, userId: string): Promise<void> {
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không phải học viên active của lớp này');
    }
  }

  private async ensureCourseInClass(classId: string, courseId: string): Promise<void> {
    const classCourse = await this.prisma.classCourse.findUnique({
      where: { classId_courseId: { classId, courseId } },
    });
    if (!classCourse) {
      throw new BadRequestException('Bài tập không thuộc khóa học của lớp này');
    }
  }

  private async ensureLessonGateActive(classId: string, lessonId: string): Promise<void> {
    const gate = await this.prisma.lessonGate.findUnique({
      where: { classId_lessonId: { classId, lessonId } },
    });
    if (!gate || !gate.isActive) {
      throw new ForbiddenException('Bài học chưa được mở cho lớp này');
    }
  }
}

type SubmissionRow = {
  id: string;
  assignmentId: string;
  userId: string;
  classId: string;
  status: string;
  contentText: string | null;
  linkUrl: string | null;
  fileId: string | null;
  score: unknown;
  feedbackMd: string | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  user?: { email: string; fullName: string } | null;
};

function toSubmissionDto(s: SubmissionRow): SubmissionDto {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    userId: s.userId,
    classId: s.classId,
    status: s.status,
    contentText: s.contentText,
    linkUrl: s.linkUrl,
    fileId: s.fileId,
    score: s.score !== null && s.score !== undefined ? Number(s.score) : null,
    feedbackMd: s.feedbackMd,
    submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
    email: s.user?.email,
    fullName: s.user?.fullName,
  };
}
