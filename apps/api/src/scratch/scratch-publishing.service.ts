import { randomBytes } from 'crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@lms/database';
import type {
  CreateScratchReportRequest,
  ScratchNicknameDto,
  ScratchPublicationDto,
  ScratchPublicProjectDto,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { ScratchAccessService } from './scratch-access.service';
import type { ScratchActor, ScratchAssetDownload } from './scratch-projects.service';
import { referencedMd5exts } from './project-json';

/** Trạng thái công khai cho chủ dự án (DTO). */
export function toPublicationDto(
  pub: {
    slug: string;
    publishedVersionId: string | null;
    publishedAt: Date | null;
    requestedVersionId: string | null;
    requestedAt: Date | null;
    decision: ScratchPublicationDto['lastDecision'];
    decisionNote: string | null;
  } | null,
): ScratchPublicationDto | null {
  if (!pub) return null;
  return {
    slug: pub.publishedVersionId ? pub.slug : null,
    published: pub.publishedVersionId !== null,
    publishedAt: pub.publishedAt?.toISOString() ?? null,
    pending: pub.requestedVersionId !== null,
    requestedAt: pub.requestedAt?.toISOString() ?? null,
    lastDecision: pub.decision,
    decisionNote: pub.decisionNote,
  };
}

/**
 * Công khai (ADR D4′, người dùng chốt 2026-10-07):
 * - chủ dự án XIN công khai phiên bản mới nhất (đóng băng ngay), kèm biệt danh; GV duyệt (moderation);
 * - trang `/p/<slug>` KHÔNG cần đăng nhập, chỉ phục vụ ĐÚNG phiên bản đã duyệt + asset mà phiên bản đó
 *   dùng — asset thêm vào dự án sau này không lọt ra ngoài;
 * - báo cáo: chỉ tài khoản đăng nhập; dự án vẫn hiện tới khi GV xử lý.
 */
@Injectable()
export class ScratchPublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScratchAccessService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  // --- Biệt danh ---

  async getNickname(userId: string): Promise<ScratchNicknameDto> {
    const row = await this.prisma.scratchNickname.findUnique({ where: { userId } });
    return { approved: row?.approved ?? null, pending: row?.pending ?? null };
  }

  /** Đặt biệt danh mới → chờ duyệt (bản đã duyệt vẫn dùng tới lúc đó). Trùng bản đã duyệt = hủy chờ. */
  async setNickname(userId: string, nickname: string): Promise<ScratchNicknameDto> {
    const value = normalizeNickname(nickname);
    const current = await this.prisma.scratchNickname.findUnique({ where: { userId } });
    const pending = value === current?.approved ? null : value;
    const row = await this.prisma.scratchNickname.upsert({
      where: { userId },
      create: { userId, pending, pendingAt: pending ? new Date() : null },
      update: { pending, pendingAt: pending ? new Date() : null },
    });
    return { approved: row.approved, pending: row.pending };
  }

  // --- Xin / gỡ công khai (chủ dự án) ---

  async request(projectId: string, nickname: string | undefined, actor: ScratchActor): Promise<ScratchPublicationDto> {
    await this.access.owned(projectId, actor.userId);
    if (nickname !== undefined) await this.setNickname(actor.userId, nickname);
    const nick = await this.getNickname(actor.userId);
    if (!nick.approved && !nick.pending) throw new BadRequestException('Cần đặt biệt danh trước khi xin công khai');

    const latest = await this.prisma.scratchProjectVersion.findFirst({
      where: { projectId },
      select: { id: true, frozenAt: true },
      orderBy: { seq: 'desc' },
    });
    if (!latest) throw new BadRequestException('Dự án chưa có nội dung');
    const existing = await this.prisma.scratchPublication.findUnique({ where: { projectId } });
    if (existing?.publishedVersionId === latest.id) {
      throw new BadRequestException('Bản này đã được công khai — sửa dự án rồi xin lại để cập nhật');
    }

    const pub = await this.prisma.$transaction(async (tx) => {
      // Đóng băng: autosave không được dọn bản đang chờ duyệt.
      if (!latest.frozenAt) {
        await tx.scratchProjectVersion.update({ where: { id: latest.id }, data: { frozenAt: new Date() } });
      }
      const row = await tx.scratchPublication.upsert({
        where: { projectId },
        create: { projectId, slug: newSlug(), requestedVersionId: latest.id, requestedAt: new Date() },
        update: { requestedVersionId: latest.id, requestedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'scratch.public.request',
          entity: 'ScratchProject',
          entityId: projectId,
          metaJson: { versionId: latest.id },
          ip: actor.ip,
        },
      });
      return row;
    });
    return toPublicationDto(pub)!;
  }

  /** Chủ dự án tự gỡ công khai / hủy yêu cầu đang chờ. */
  async withdraw(projectId: string, actor: ScratchActor): Promise<ScratchPublicationDto | null> {
    await this.access.owned(projectId, actor.userId);
    const existing = await this.prisma.scratchPublication.findUnique({ where: { projectId } });
    if (!existing) return null;
    const pub = await this.prisma.$transaction(async (tx) => {
      const row = await tx.scratchPublication.update({
        where: { projectId },
        data: {
          publishedVersionId: null,
          requestedVersionId: null,
          requestedAt: null,
          decision: 'withdrawn',
          decisionNote: null,
          decidedById: actor.userId,
          decidedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'scratch.public.withdraw',
          entity: 'ScratchProject',
          entityId: projectId,
          ip: actor.ip,
        },
      });
      return row;
    });
    return toPublicationDto(pub);
  }

  // --- Trang công khai (KHÔNG cần đăng nhập) ---

  async publicProject(slug: string): Promise<ScratchPublicProjectDto> {
    const pub = await this.livePublication(slug);
    return {
      slug,
      title: pub.publishedTitle ?? 'BlockSpace',
      // INVARIANT #5: chỉ biệt danh đã duyệt — không họ tên, lớp, trường.
      nickname: pub.project.owner.scratchNickname?.approved ?? 'Bạn nhỏ CodeSpace',
      publishedAt: (pub.publishedAt ?? new Date()).toISOString(),
    };
  }

  async publicProjectJson(slug: string): Promise<unknown> {
    return (await this.livePublication(slug)).publishedVersion!.projectJson;
  }

  /** Asset công khai: phải được phiên bản ĐÃ DUYỆT dùng (không chỉ thuộc dự án) và có trên server. */
  async publicAsset(slug: string, md5ext: string): Promise<ScratchAssetDownload> {
    const pub = await this.livePublication(slug);
    if (!referencedMd5exts(pub.publishedVersion!.projectJson).includes(md5ext)) {
      throw new NotFoundException('Asset không thuộc bản công khai');
    }
    const link = await this.prisma.scratchProjectAsset.findUnique({
      where: { projectId_md5ext: { projectId: pub.projectId, md5ext } },
      select: { asset: { select: { storageKey: true, mime: true } } },
    });
    if (!link) throw new NotFoundException('Asset không thuộc bản công khai');
    return { buffer: await this.storage.get(link.asset.storageKey), mime: link.asset.mime };
  }

  private async livePublication(slug: string) {
    const pub = await this.prisma.scratchPublication.findUnique({
      where: { slug },
      select: {
        projectId: true,
        publishedTitle: true,
        publishedAt: true,
        publishedVersion: { select: { projectJson: true } },
        project: {
          select: { deletedAt: true, owner: { select: { scratchNickname: { select: { approved: true } } } } },
        },
      },
    });
    // Không công khai / đã gỡ / dự án đã xóa ⇒ 404 như không tồn tại.
    if (!pub?.publishedVersion || pub.project.deletedAt) throw new NotFoundException('Dự án không tồn tại');
    return pub;
  }

  // --- Báo cáo ---

  /** Báo cáo dự án trong LMS (người xem được) — một báo cáo / người / dự án, báo lại = cập nhật. */
  async report(projectId: string, dto: CreateScratchReportRequest, reporterId: string): Promise<void> {
    const access = await this.access.readable(projectId, reporterId);
    if (access.isOwner) throw new BadRequestException('Không tự báo cáo dự án của mình');
    await this.saveReport(projectId, dto, reporterId);
  }

  /** Báo cáo từ trang công khai — cần đăng nhập, không cần xem được dự án trong LMS. */
  async reportPublic(slug: string, dto: CreateScratchReportRequest, reporterId: string): Promise<void> {
    const pub = await this.livePublication(slug);
    const project = await this.prisma.scratchProject.findUniqueOrThrow({
      where: { id: pub.projectId },
      select: { ownerId: true },
    });
    if (project.ownerId === reporterId) throw new BadRequestException('Không tự báo cáo dự án của mình');
    await this.saveReport(pub.projectId, dto, reporterId);
  }

  private async saveReport(projectId: string, dto: CreateScratchReportRequest, reporterId: string) {
    const data: Prisma.ScratchReportUncheckedUpdateInput = {
      reason: dto.reason,
      note: dto.note?.trim() || null,
      createdAt: new Date(),
      resolvedAt: null,
      resolvedById: null,
      resolution: null,
    };
    await this.prisma.scratchReport.upsert({
      where: { projectId_reporterId: { projectId, reporterId } },
      create: { projectId, reporterId, reason: dto.reason, note: dto.note?.trim() || null },
      update: data,
    });
  }
}

/** Mã link công khai: 12 ký tự base64url ngẫu nhiên (72 bit) — không đoán, không lộ id. */
function newSlug(): string {
  return randomBytes(9).toString('base64url');
}

function normalizeNickname(nickname: string): string {
  return nickname.normalize('NFC').trim().replace(/\s+/g, ' ');
}
