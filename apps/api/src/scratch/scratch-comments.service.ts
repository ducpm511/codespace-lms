import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@lms/database';
import { SCRATCH_COMMENT_LIST_LIMIT, SCRATCH_COMMENT_MAX_LENGTH } from '@lms/contracts';
import type { CreateScratchReportRequest, ScratchCommentDto, ScratchCommentsDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ScratchAccessService } from './scratch-access.service';
import { ScratchModeratorsService } from './scratch-moderators.service';
import { effectiveVisibility, type ScratchActor } from './scratch-projects.service';
import { containsBanned } from './word-filter';
import { assertCommentQuota, assertReportQuota } from './rate-limits';

/**
 * Bình luận BlockSpace (T11.8 — ADR D8; người dùng chốt 2026-10-15):
 * - ai XEM được dự án thì bình luận được, nhưng chỉ khi dự án chia sẻ lớp / trường (kể cả bản đã công khai —
 *   bình luận chỉ trong LMS, trang /p KHÔNG BAO GIỜ có bình luận). Dự án private: không có bình luận;
 * - chủ dự án ẩn / bỏ ẩn bình luận trên dự án mình và bật / tắt bình luận mới; KHÔNG xóa được;
 * - GV (của chủ dự án HOẶC của người viết) + admin: ẩn, xóa (mềm); tác giả tự xóa bình luận của mình;
 * - từ cấm ⇒ chặn, không nói từ nào (khỏi lách); giới hạn tần suất (rate-limits.ts);
 * - audit cùng transaction, KHÔNG ghi nội dung bình luận (có thể có tên / thông tin của trẻ).
 */
@Injectable()
export class ScratchCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScratchAccessService,
    private readonly moderators: ScratchModeratorsService,
  ) {}

  async list(projectId: string, userId: string): Promise<ScratchCommentsDto> {
    const { project, isOwner } = await this.project(projectId, userId);
    const available = isShared(project);
    const canModerate = !isOwner && (await this.moderators.canModerate(userId, project.ownerId));
    const seeHidden = isOwner || canModerate;
    const rows = available
      ? await this.prisma.scratchComment.findMany({
          where: { projectId, deletedAt: null, ...(seeHidden ? {} : { hiddenAt: null }) },
          select: {
            id: true,
            authorId: true,
            content: true,
            hiddenAt: true,
            createdAt: true,
            author: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: SCRATCH_COMMENT_LIST_LIMIT,
        })
      : [];
    return {
      available,
      open: project.commentsEnabled,
      canComment: available && (project.commentsEnabled || isOwner),
      isOwner,
      canModerate,
      items: rows.map((r): ScratchCommentDto => ({
        id: r.id,
        authorId: r.authorId,
        authorName: r.author.fullName,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        hidden: r.hiddenAt !== null,
        mine: r.authorId === userId,
      })),
    };
  }

  async create(projectId: string, content: string, userId: string): Promise<ScratchCommentDto> {
    const { project, isOwner } = await this.project(projectId, userId);
    if (!isShared(project)) throw new ForbiddenException('Dự án chưa chia sẻ nên chưa bình luận được');
    if (!project.commentsEnabled && !isOwner) throw new ForbiddenException('Chủ dự án đã tắt bình luận');
    const text = content.normalize('NFC').trim();
    if (!text) throw new BadRequestException('Bình luận trống');
    if (text.length > SCRATCH_COMMENT_MAX_LENGTH) {
      throw new BadRequestException(`Bình luận tối đa ${SCRATCH_COMMENT_MAX_LENGTH} ký tự`);
    }
    const banned = await this.prisma.scratchBannedWord.findMany({ select: { word: true } });
    if (
      containsBanned(
        text,
        banned.map((b) => b.word),
      )
    ) {
      throw new BadRequestException('Bình luận có từ không phù hợp — em sửa lại nhé');
    }
    await assertCommentQuota(this.prisma, userId);
    const row = await this.prisma.scratchComment.create({
      data: { projectId, authorId: userId, content: text },
      select: { id: true, createdAt: true, author: { select: { fullName: true } } },
    });
    return {
      id: row.id,
      authorId: userId,
      authorName: row.author.fullName,
      content: text,
      createdAt: row.createdAt.toISOString(),
      hidden: false,
      mine: true,
    };
  }

  /** Tác giả tự xóa, hoặc GV / admin. Chủ dự án chỉ ẩn được (người dùng chốt). */
  async remove(commentId: string, actor: ScratchActor): Promise<void> {
    const c = await this.comment(commentId, actor.userId);
    const self = c.authorId === actor.userId;
    if (!self && !(await this.canModerateComment(actor.userId, c))) {
      throw new ForbiddenException('Chỉ người viết hoặc giáo viên được xóa bình luận');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.scratchComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), deletedById: actor.userId },
      });
      await tx.scratchCommentReport.updateMany({
        where: { commentId, resolvedAt: null },
        data: { resolvedAt: new Date(), resolvedById: actor.userId, resolution: 'deleted' },
      });
      await audit(tx, actor, 'scratch.comment.delete', c.projectId, { commentId, self });
    });
  }

  /** Ẩn / bỏ ẩn: chủ dự án hoặc GV / admin. */
  async setHidden(commentId: string, hidden: boolean, actor: ScratchActor): Promise<void> {
    const c = await this.comment(commentId, actor.userId);
    const byOwner = c.project.ownerId === actor.userId;
    if (!byOwner && !(await this.canModerateComment(actor.userId, c))) {
      throw new ForbiddenException('Chỉ chủ dự án hoặc giáo viên được ẩn bình luận');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.scratchComment.update({
        where: { id: commentId },
        data: hidden ? { hiddenAt: new Date(), hiddenById: actor.userId } : { hiddenAt: null, hiddenById: null },
      });
      await audit(tx, actor, hidden ? 'scratch.comment.hide' : 'scratch.comment.unhide', c.projectId, {
        commentId,
        by: byOwner ? 'owner' : 'moderator',
      });
    });
  }

  /** Chủ dự án bật / tắt bình luận MỚI (bình luận cũ vẫn hiện). */
  async setOpen(projectId: string, open: boolean, actor: ScratchActor): Promise<void> {
    await this.access.owned(projectId, actor.userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.scratchProject.update({ where: { id: projectId }, data: { commentsEnabled: open } });
      await audit(tx, actor, open ? 'scratch.comments.open' : 'scratch.comments.close', projectId, {});
    });
  }

  /** Báo cáo bình luận người khác — 1 báo cáo / người / bình luận (báo lại = cập nhật, mở lại nếu đã xử lý). */
  async report(commentId: string, dto: CreateScratchReportRequest, reporterId: string): Promise<void> {
    const c = await this.comment(commentId, reporterId);
    if (c.authorId === reporterId) throw new BadRequestException('Không tự báo cáo bình luận của mình');
    await assertReportQuota(this.prisma, reporterId);
    const note = dto.note?.trim() || null;
    await this.prisma.scratchCommentReport.upsert({
      where: { commentId_reporterId: { commentId, reporterId } },
      create: { commentId, reporterId, reason: dto.reason, note },
      update: {
        reason: dto.reason,
        note,
        createdAt: new Date(),
        resolvedAt: null,
        resolvedById: null,
        resolution: null,
      },
    });
  }

  /** GV của chủ dự án HOẶC của người viết (bình luận trên dự án cả trường có thể của em lớp khác). */
  async canModerateComment(userId: string, c: { authorId: string; project: { ownerId: string } }): Promise<boolean> {
    return (
      (await this.moderators.canModerate(userId, c.project.ownerId)) ||
      (await this.moderators.canModerate(userId, c.authorId))
    );
  }

  private async project(projectId: string, userId: string) {
    const access = await this.access.readable(projectId, userId);
    const project = await this.prisma.scratchProject.findUniqueOrThrow({
      where: { id: projectId },
      select: { ownerId: true, visibility: true, classId: true, commentsEnabled: true },
    });
    return { project, isOwner: access.isOwner };
  }

  /** Bình luận còn tồn tại, trên dự án người này XEM được (không xem được ⇒ 404, không lộ là có bình luận). */
  private async comment(commentId: string, userId: string) {
    const c = await this.prisma.scratchComment.findUnique({
      where: { id: commentId },
      select: { authorId: true, projectId: true, deletedAt: true, project: { select: { ownerId: true } } },
    });
    if (!c || c.deletedAt) throw new NotFoundException('Bình luận không tồn tại');
    await this.access.readable(c.projectId, userId);
    return c;
  }
}

function isShared(p: { visibility: string; classId: string | null }): boolean {
  return effectiveVisibility(p.visibility as never, p.classId) !== 'private';
}

function audit(
  tx: Prisma.TransactionClient,
  actor: ScratchActor,
  action: string,
  projectId: string,
  meta: Record<string, string | boolean>,
) {
  return tx.auditLog.create({
    data: {
      actorId: actor.userId,
      action,
      entity: 'ScratchProject',
      entityId: projectId,
      ip: actor.ip,
      metaJson: meta,
    },
  });
}
