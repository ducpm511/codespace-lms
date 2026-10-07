import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SCRATCH_COLLAB_SEARCH_LIMIT, SCRATCH_COLLAB_SEARCH_MIN, SCRATCH_MAX_COLLABORATORS } from '@lms/contracts';
import type { ScratchCollaboratorCandidateDto, ScratchCollaboratorDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ScratchAccessService } from './scratch-access.service';
import type { ScratchActor } from './scratch-projects.service';
import { CollabGateway } from './collab/collab.gateway';

/** `minh.tran@codespace.vn` → `mi***@codespace.vn`: đủ phân biệt người trùng tên, không lộ cả địa chỉ. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/**
 * Đồng tác giả (T11.6b — ADR D5′). Người dùng chốt: chủ dự án mời BẤT KỲ AI trong trường (tài khoản đang
 * hoạt động), tối đa SCRATCH_MAX_COLLABORATORS; chủ gỡ được mọi người, đồng tác giả tự rời được; bị gỡ / rời
 * ⇒ kết nối làm chung của người đó đóng NGAY (những gì đã đồng bộ vẫn giữ trong dự án).
 */
@Injectable()
export class ScratchCollaboratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScratchAccessService,
    private readonly collab: CollabGateway,
  ) {}

  /** Tìm người để mời — chỉ chủ dự án; theo họ tên hoặc email, bỏ chủ + người đã là đồng tác giả. */
  async candidates(projectId: string, query: string, userId: string): Promise<ScratchCollaboratorCandidateDto[]> {
    await this.access.owned(projectId, userId);
    const q = query.trim();
    if (q.length < SCRATCH_COLLAB_SEARCH_MIN) return [];
    const rows = await this.prisma.user.findMany({
      where: {
        status: 'active',
        id: { not: userId },
        scratchCollabs: { none: { projectId } },
        OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { startsWith: q, mode: 'insensitive' } }],
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
      take: SCRATCH_COLLAB_SEARCH_LIMIT,
    });
    return rows.map((r) => ({ userId: r.id, fullName: r.fullName, emailHint: maskEmail(r.email) }));
  }

  /** Mời (idempotent: đã là đồng tác giả thì thôi). Báo cho người được mời; audit cùng transaction. */
  async add(projectId: string, inviteeId: string, actor: ScratchActor): Promise<ScratchCollaboratorDto[]> {
    await this.access.owned(projectId, actor.userId);
    if (inviteeId === actor.userId) throw new BadRequestException('Bạn đã là chủ dự án');
    const invitee = await this.prisma.user.findUnique({
      where: { id: inviteeId },
      select: { status: true },
    });
    if (!invitee || invitee.status !== 'active') throw new NotFoundException('Không tìm thấy người này');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.scratchCollaborator.findMany({ where: { projectId }, select: { userId: true } });
      if (existing.some((c) => c.userId === inviteeId)) return;
      if (existing.length >= SCRATCH_MAX_COLLABORATORS) {
        throw new ConflictException(`Mỗi dự án tối đa ${SCRATCH_MAX_COLLABORATORS} đồng tác giả`);
      }
      const project = await tx.scratchProject.findUniqueOrThrow({
        where: { id: projectId },
        select: { title: true, owner: { select: { fullName: true } } },
      });
      await tx.scratchCollaborator.create({ data: { projectId, userId: inviteeId, invitedById: actor.userId } });
      await tx.notification.create({
        data: {
          userId: inviteeId,
          type: 'scratch.collab.invited',
          title: 'Bạn được mời cùng làm một dự án BlockSpace! 🧩',
          message: `${project.owner.fullName} mời bạn cùng làm "${project.title}". Mở BlockSpace › Dự án của tôi để bắt đầu.`,
          payloadJson: { projectId },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'scratch.collab.add',
          entity: 'ScratchProject',
          entityId: projectId,
          ip: actor.ip,
          metaJson: { userId: inviteeId },
        },
      });
    });
    return this.list(projectId);
  }

  /** Chủ gỡ bất kỳ ai; đồng tác giả chỉ gỡ được chính mình (rời dự án). */
  async remove(projectId: string, memberId: string, actor: ScratchActor): Promise<ScratchCollaboratorDto[]> {
    const access = await this.access.editable(projectId, actor.userId);
    const leaving = memberId === actor.userId;
    if (!access.isOwner && !leaving) throw new ForbiddenException('Chỉ chủ dự án được gỡ đồng tác giả');
    if (access.isOwner && leaving) throw new BadRequestException('Chủ dự án không rời dự án của mình được');

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.scratchCollaborator.deleteMany({ where: { projectId, userId: memberId } });
      if (count === 0) throw new NotFoundException('Người này không phải đồng tác giả');
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: leaving ? 'scratch.collab.leave' : 'scratch.collab.remove',
          entity: 'ScratchProject',
          entityId: projectId,
          ip: actor.ip,
          metaJson: { userId: memberId },
        },
      });
    });
    // Sau khi commit: đóng mọi kết nối của người đó trong phòng (không đợi lần kiểm quyền định kỳ).
    this.collab.kick(projectId, memberId);
    return leaving ? [] : this.list(projectId);
  }

  private async list(projectId: string): Promise<ScratchCollaboratorDto[]> {
    const rows = await this.prisma.scratchCollaborator.findMany({
      where: { projectId },
      select: { userId: true, createdAt: true, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((c) => ({ userId: c.userId, fullName: c.user.fullName, createdAt: c.createdAt.toISOString() }));
  }
}
