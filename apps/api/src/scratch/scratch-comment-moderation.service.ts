import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import type { ScratchBannedWordDto, ScratchCommentReportActionValue } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ScratchCommentsService } from './scratch-comments.service';
import { ScratchModeratorsService } from './scratch-moderators.service';
import type { ScratchActor } from './scratch-projects.service';
import { normalizeBannedWord } from './word-filter';

/**
 * Kiểm duyệt bình luận (T11.8): xử lý báo cáo bình luận (GV của chủ dự án / người viết, hoặc admin) và danh sách
 * từ cấm (CHỈ `scratch.moderate` — admin; người dùng chốt "admin sửa trên web"). Audit cùng transaction.
 */
@Injectable()
export class ScratchCommentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderators: ScratchModeratorsService,
    private readonly comments: ScratchCommentsService,
  ) {}

  /** `dismiss`: không vi phạm (chỉ báo cáo này). `hide` / `delete`: xử lý bình luận + đóng MỌI báo cáo mở của nó. */
  async resolveReport(reportId: string, action: ScratchCommentReportActionValue, actor: ScratchActor): Promise<void> {
    const report = await this.prisma.scratchCommentReport.findUnique({
      where: { id: reportId },
      select: {
        resolvedAt: true,
        commentId: true,
        comment: { select: { authorId: true, projectId: true, project: { select: { ownerId: true } } } },
      },
    });
    if (!report) throw new NotFoundException('Báo cáo không tồn tại');
    if (!(await this.comments.canModerateComment(actor.userId, report.comment))) {
      throw new ForbiddenException('Bạn không phải giáo viên của học viên này');
    }
    if (report.resolvedAt) throw new ConflictException('Báo cáo đã được xử lý');
    const now = new Date();
    const resolved = { resolvedAt: now, resolvedById: actor.userId };

    await this.prisma.$transaction(async (tx) => {
      if (action === 'dismiss') {
        await tx.scratchCommentReport.update({
          where: { id: reportId },
          data: { ...resolved, resolution: 'dismissed' },
        });
      } else {
        await tx.scratchComment.update({
          where: { id: report.commentId },
          data:
            action === 'hide'
              ? { hiddenAt: now, hiddenById: actor.userId }
              : { deletedAt: now, deletedById: actor.userId },
        });
        await tx.scratchCommentReport.updateMany({
          where: { commentId: report.commentId, resolvedAt: null },
          data: { ...resolved, resolution: action === 'hide' ? 'hidden' : 'deleted' },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: `scratch.comment.report.${action}`,
          entity: 'ScratchProject',
          entityId: report.comment.projectId,
          metaJson: { reportId, commentId: report.commentId },
          ip: actor.ip,
        },
      });
    });
  }

  // --- Từ cấm (chỉ admin) ---

  async listBannedWords(userId: string): Promise<ScratchBannedWordDto[]> {
    await this.assertAdmin(userId);
    const rows = await this.prisma.scratchBannedWord.findMany({ orderBy: { word: 'asc' } });
    return rows.map((r) => ({ word: r.word, createdAt: r.createdAt.toISOString() }));
  }

  async addBannedWord(input: string, actor: ScratchActor): Promise<ScratchBannedWordDto[]> {
    await this.assertAdmin(actor.userId);
    const word = normalizeBannedWord(input);
    if (!word) throw new BadRequestException('Từ cấm phải có ít nhất một chữ cái hoặc chữ số');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.scratchBannedWord.create({ data: { word, createdById: actor.userId } });
        await this.audit(tx, actor, 'scratch.bannedword.add', word);
      });
    } catch (e) {
      // Đã có ⇒ coi như xong (idempotent).
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    return this.listBannedWords(actor.userId);
  }

  async removeBannedWord(input: string, actor: ScratchActor): Promise<ScratchBannedWordDto[]> {
    await this.assertAdmin(actor.userId);
    const word = normalizeBannedWord(input);
    if (word) {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.scratchBannedWord.deleteMany({ where: { word } });
        if (count) await this.audit(tx, actor, 'scratch.bannedword.remove', word);
      });
    }
    return this.listBannedWords(actor.userId);
  }

  private async assertAdmin(userId: string): Promise<void> {
    if (!(await this.moderators.isGlobalModerator(userId))) {
      throw new ForbiddenException('Chỉ quản trị viên được sửa danh sách từ cấm');
    }
  }

  private audit(tx: Prisma.TransactionClient, actor: ScratchActor, action: string, word: string) {
    return tx.auditLog.create({
      data: { actorId: actor.userId, action, entity: 'ScratchBannedWord', entityId: word, metaJson: {}, ip: actor.ip },
    });
  }
}
