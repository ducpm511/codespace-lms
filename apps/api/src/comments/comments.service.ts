import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { LessonCommentDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForLesson(lessonId: string, classId: string, userId: string): Promise<LessonCommentDto[]> {
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không thuộc lớp học này');
    }

    const rows = await this.prisma.lessonComment.findMany({
      where: { lessonId, classId },
      include: { user: { select: { fullName: true, avatarUrl: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      lessonId: r.lessonId,
      classId: r.classId,
      userId: r.userId,
      userName: r.user.fullName || r.user.email,
      userAvatarUrl: r.user.avatarUrl,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async create(lessonId: string, dto: CreateCommentDto, userId: string): Promise<LessonCommentDto> {
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId: dto.classId, userId } },
      select: { status: true },
    });
    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không thuộc lớp học này');
    }

    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
    if (!lesson) {
      throw new NotFoundException('Bài học không tồn tại');
    }

    const created = await this.prisma.lessonComment.create({
      data: {
        lessonId,
        classId: dto.classId,
        userId,
        content: dto.content,
      },
      include: { user: { select: { fullName: true, avatarUrl: true, email: true } } },
    });

    return {
      id: created.id,
      lessonId: created.lessonId,
      classId: created.classId,
      userId: created.userId,
      userName: created.user.fullName || created.user.email,
      userAvatarUrl: created.user.avatarUrl,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}
