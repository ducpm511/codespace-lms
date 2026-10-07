import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ScratchModerationQueueDto, ScratchReportReasonValue } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { ScratchModeratorsService } from './scratch-moderators.service';
import type { ScratchActor, ScratchAssetDownload } from './scratch-projects.service';
import { referencedMd5exts } from './project-json';

/**
 * Kiểm duyệt BlockSpace (T11.5b). Mọi quyết định: kiểm người duyệt có quyền với CHỦ dự án
 * (ScratchModeratorsService) TRƯỚC khi đọc/ghi, rồi ghi audit trong cùng transaction (INVARIANT #6).
 */
@Injectable()
export class ScratchModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderators: ScratchModeratorsService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async queue(moderatorId: string): Promise<ScratchModerationQueueDto> {
    const owner = await this.moderators.studentScope(moderatorId);
    const [pubs, reports, nicknames] = await Promise.all([
      this.prisma.scratchPublication.findMany({
        where: { requestedVersionId: { not: null }, project: { deletedAt: null, owner } },
        select: {
          projectId: true,
          requestedAt: true,
          publishedVersionId: true,
          project: {
            select: {
              title: true,
              owner: { select: { fullName: true, scratchNickname: { select: { approved: true, pending: true } } } },
            },
          },
        },
        orderBy: { requestedAt: 'asc' },
      }),
      this.prisma.scratchReport.findMany({
        where: { resolvedAt: null, project: { deletedAt: null, owner } },
        select: {
          id: true,
          projectId: true,
          reason: true,
          note: true,
          createdAt: true,
          reporter: { select: { fullName: true } },
          project: {
            select: {
              title: true,
              owner: { select: { fullName: true } },
              publication: { select: { publishedVersionId: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.scratchNickname.findMany({
        where: { pending: { not: null }, user: owner },
        select: { userId: true, approved: true, pending: true, user: { select: { fullName: true } } },
        orderBy: { pendingAt: 'asc' },
      }),
    ]);
    return {
      publications: pubs.map((p) => {
        const nick = p.project.owner.scratchNickname;
        return {
          projectId: p.projectId,
          title: p.project.title,
          ownerName: p.project.owner.fullName,
          nickname: nick?.pending ?? nick?.approved ?? null,
          nicknameIsNew: Boolean(nick?.pending),
          requestedAt: p.requestedAt!.toISOString(),
          alreadyPublished: p.publishedVersionId !== null,
        };
      }),
      reports: reports.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        projectTitle: r.project.title,
        ownerName: r.project.owner.fullName,
        reporterName: r.reporter.fullName,
        reason: r.reason as ScratchReportReasonValue,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        isPublic: Boolean(r.project.publication?.publishedVersionId),
        publicSlug: r.project.publication?.publishedVersionId ? r.project.publication.slug : null,
      })),
      nicknames: nicknames.map((n) => ({
        userId: n.userId,
        fullName: n.user.fullName,
        approved: n.approved,
        pending: n.pending!,
      })),
    };
  }

  // --- Xem bản đang chờ duyệt (GV có thể không xem được dự án private trong LMS) ---

  async requestedJson(projectId: string, moderatorId: string): Promise<unknown> {
    return (await this.pendingRequest(projectId, moderatorId)).requestedVersion!.projectJson;
  }

  async requestedAsset(projectId: string, md5ext: string, moderatorId: string): Promise<ScratchAssetDownload> {
    const pub = await this.pendingRequest(projectId, moderatorId);
    if (!referencedMd5exts(pub.requestedVersion!.projectJson).includes(md5ext)) {
      throw new NotFoundException('Asset không thuộc bản chờ duyệt');
    }
    const link = await this.prisma.scratchProjectAsset.findUnique({
      where: { projectId_md5ext: { projectId, md5ext } },
      select: { asset: { select: { storageKey: true, mime: true } } },
    });
    if (!link) throw new NotFoundException('Asset không thuộc bản chờ duyệt');
    return { buffer: await this.storage.get(link.asset.storageKey), mime: link.asset.mime };
  }

  // --- Quyết định công khai ---

  /** Duyệt: bản chờ duyệt thành bản công khai (tên chụp lúc này); biệt danh chờ duyệt được duyệt cùng. */
  async approve(projectId: string, actor: ScratchActor): Promise<void> {
    const pub = await this.pendingRequest(projectId, actor.userId);
    const nick = await this.prisma.scratchNickname.findUnique({ where: { userId: pub.project.ownerId } });
    if (!nick?.pending && !nick?.approved) throw new BadRequestException('Học viên chưa có biệt danh');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.scratchPublication.update({
        where: { projectId },
        data: {
          publishedVersionId: pub.requestedVersionId,
          publishedTitle: pub.project.title,
          publishedAt: now,
          requestedVersionId: null,
          requestedAt: null,
          decision: 'approved',
          decisionNote: null,
          decidedById: actor.userId,
          decidedAt: now,
        },
      });
      if (nick.pending) {
        await tx.scratchNickname.update({
          where: { userId: nick.userId },
          data: { approved: nick.pending, pending: null, pendingAt: null, reviewedById: actor.userId, reviewedAt: now },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'scratch.public.approve',
          entity: 'ScratchProject',
          entityId: projectId,
          metaJson: { versionId: pub.requestedVersionId, nicknameApproved: Boolean(nick.pending) },
          ip: actor.ip,
        },
      });
    });
  }

  /** Từ chối yêu cầu — bản công khai cũ (nếu có) vẫn giữ. */
  async reject(projectId: string, note: string | undefined, actor: ScratchActor): Promise<void> {
    await this.pendingRequest(projectId, actor.userId);
    await this.decide(projectId, 'rejected', note, actor, { requestedVersionId: null, requestedAt: null });
  }

  /** Gỡ bản công khai ngay (và hủy yêu cầu đang chờ). */
  async remove(projectId: string, note: string | undefined, actor: ScratchActor): Promise<void> {
    const pub = await this.prisma.scratchPublication.findUnique({
      where: { projectId },
      select: { project: { select: { ownerId: true } } },
    });
    if (!pub) throw new NotFoundException('Dự án chưa từng công khai');
    await this.moderators.assertCanModerate(actor.userId, pub.project.ownerId);
    await this.decide(projectId, 'removed', note, actor, {
      publishedVersionId: null,
      requestedVersionId: null,
      requestedAt: null,
    });
  }

  private async decide(
    projectId: string,
    decision: 'rejected' | 'removed',
    note: string | undefined,
    actor: ScratchActor,
    data: Record<string, null>,
  ) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.scratchPublication.update({
        where: { projectId },
        data: { ...data, decision, decisionNote: note?.trim() || null, decidedById: actor.userId, decidedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: `scratch.public.${decision === 'rejected' ? 'reject' : 'remove'}`,
          entity: 'ScratchProject',
          entityId: projectId,
          // Lời nhắn có thể nhắc tên học viên — chỉ ghi là CÓ lời nhắn (như gamification.award).
          metaJson: { hasNote: Boolean(note?.trim()) },
          ip: actor.ip,
        },
      }),
    ]);
  }

  // --- Biệt danh ---

  async decideNickname(userId: string, approve: boolean, actor: ScratchActor): Promise<void> {
    const nick = await this.prisma.scratchNickname.findUnique({ where: { userId } });
    if (!nick?.pending) throw new NotFoundException('Không có biệt danh chờ duyệt');
    await this.moderators.assertCanModerate(actor.userId, userId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.scratchNickname.update({
        where: { userId },
        data: {
          ...(approve ? { approved: nick.pending } : {}),
          pending: null,
          pendingAt: null,
          reviewedById: actor.userId,
          reviewedAt: now,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: approve ? 'scratch.nickname.approve' : 'scratch.nickname.reject',
          entity: 'User',
          entityId: userId,
          ip: actor.ip,
        },
      }),
    ]);
  }

  // --- Báo cáo ---

  /**
   * `dismiss`: không vi phạm. `remove`: gỡ bản công khai + thu chia sẻ về "chỉ mình tôi", đóng MỌI báo cáo
   * đang mở của dự án đó.
   */
  async resolveReport(reportId: string, action: 'dismiss' | 'remove', actor: ScratchActor): Promise<void> {
    const report = await this.prisma.scratchReport.findUnique({
      where: { id: reportId },
      select: { projectId: true, resolvedAt: true, project: { select: { ownerId: true } } },
    });
    if (!report) throw new NotFoundException('Báo cáo không tồn tại');
    await this.moderators.assertCanModerate(actor.userId, report.project.ownerId);
    if (report.resolvedAt) throw new ConflictException('Báo cáo đã được xử lý');
    const now = new Date();
    const resolved = { resolvedAt: now, resolvedById: actor.userId };

    await this.prisma.$transaction(async (tx) => {
      if (action === 'dismiss') {
        await tx.scratchReport.update({ where: { id: reportId }, data: { ...resolved, resolution: 'dismissed' } });
      } else {
        await tx.scratchReport.updateMany({
          where: { projectId: report.projectId, resolvedAt: null },
          data: { ...resolved, resolution: 'removed' },
        });
        await tx.scratchProject.update({
          where: { id: report.projectId },
          data: { visibility: 'private', classId: null },
        });
        await tx.scratchPublication.updateMany({
          where: { projectId: report.projectId },
          data: {
            publishedVersionId: null,
            requestedVersionId: null,
            requestedAt: null,
            decision: 'removed',
            decidedById: actor.userId,
            decidedAt: now,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: `scratch.report.${action}`,
          entity: 'ScratchProject',
          entityId: report.projectId,
          metaJson: { reportId },
          ip: actor.ip,
        },
      });
    });
  }

  /** Yêu cầu công khai đang chờ của dự án + kiểm quyền người duyệt với chủ dự án. */
  private async pendingRequest(projectId: string, moderatorId: string) {
    const pub = await this.prisma.scratchPublication.findUnique({
      where: { projectId },
      select: {
        requestedVersionId: true,
        requestedVersion: { select: { projectJson: true } },
        project: { select: { ownerId: true, title: true, deletedAt: true } },
      },
    });
    if (!pub || pub.project.deletedAt) throw new NotFoundException('Dự án không tồn tại');
    await this.moderators.assertCanModerate(moderatorId, pub.project.ownerId);
    if (!pub.requestedVersionId || !pub.requestedVersion) throw new NotFoundException('Không có yêu cầu chờ duyệt');
    return pub;
  }
}
