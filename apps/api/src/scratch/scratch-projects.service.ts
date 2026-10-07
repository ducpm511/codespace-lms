import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import { SCRATCH_KEEP_UNFROZEN_VERSIONS } from '@lms/contracts';
import type {
  ScratchProjectDetailDto,
  ScratchProjectSummaryDto,
  ScratchProjectVersionDto,
  ScratchVisibilityValue,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { ScratchAccessService } from './scratch-access.service';
import { parseProjectJson } from './project-json';
import type { CreateScratchProjectDto } from './dto/create-scratch-project.dto';
import type { UpdateScratchProjectDto } from './dto/update-scratch-project.dto';

export interface ScratchActor {
  userId: string;
  ip?: string;
}

export interface ScratchAssetDownload {
  buffer: Buffer;
  mime: string;
}

/** Lấy đủ cho DTO tóm tắt; `likes` lọc theo người xem để biết `likedByMe`. */
const summarySelect = (viewerId: string) =>
  ({
    id: true,
    title: true,
    visibility: true,
    classId: true,
    ownerId: true,
    remixOfId: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: { fullName: true } },
    versions: { select: { seq: true }, orderBy: { seq: 'desc' }, take: 1 },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { likes: true } },
  }) satisfies Prisma.ScratchProjectSelect;

type SummaryRow = Prisma.ScratchProjectGetPayload<{ select: ReturnType<typeof summarySelect> }>;

function toSummary(row: SummaryRow): ScratchProjectSummaryDto {
  return {
    id: row.id,
    title: row.title,
    visibility: row.visibility,
    // Lớp bị xóa ⇒ classId NULL: báo đúng phạm vi thật (= private) thay vì "class" không lớp.
    classId: row.classId,
    ownerId: row.ownerId,
    ownerName: row.owner.fullName,
    remixOfId: row.remixOfId,
    latestSeq: row.versions[0]?.seq ?? null,
    likeCount: row._count.likes,
    likedByMe: row.likes.length > 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const effectiveVisibility = (v: ScratchVisibilityValue, classId: string | null): ScratchVisibilityValue =>
  v === 'class' && classId === null ? 'private' : v;

/** Lưu đồng thời hai lần cùng lúc có thể tranh cùng `seq` — thử lại vài lần. */
const SAVE_ATTEMPTS = 3;

@Injectable()
export class ScratchProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScratchAccessService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  /** Dự án của tôi + dự án tôi là đồng tác giả (chưa xóa), mới sửa trước. */
  async listMine(userId: string): Promise<ScratchProjectSummaryDto[]> {
    const rows = await this.prisma.scratchProject.findMany({
      where: { deletedAt: null, OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }] },
      select: summarySelect(userId),
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.withEffectiveVisibility(toSummary(r)));
  }

  async create(dto: CreateScratchProjectDto, userId: string): Promise<ScratchProjectDetailDto> {
    const project = await this.prisma.scratchProject.create({
      data: { ownerId: userId, title: dto.title.trim() },
      select: { id: true },
    });
    return this.detail(project.id, userId);
  }

  async detail(projectId: string, userId: string): Promise<ScratchProjectDetailDto> {
    const access = await this.access.readable(projectId, userId);
    const row = await this.prisma.scratchProject.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        ...summarySelect(userId),
        collaborators: {
          select: { userId: true, createdAt: true, user: { select: { fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return {
      ...this.withEffectiveVisibility(toSummary(row)),
      remixOf: row.remixOfId ? await this.remixOrigin(row.remixOfId, userId) : null,
      isOwner: access.isOwner,
      canEdit: access.canEdit,
      collaborators: row.collaborators.map((c) => ({
        userId: c.userId,
        fullName: c.user.fullName,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  /** Đổi tên / phạm vi chia sẻ — chỉ chủ dự án. Đổi phạm vi ghi audit cùng transaction (INVARIANT #6). */
  async update(projectId: string, dto: UpdateScratchProjectDto, actor: ScratchActor): Promise<ScratchProjectDetailDto> {
    const access = await this.access.owned(projectId, actor.userId);
    if (access.visibility === 'public') {
      // Bản công khai đã được GV duyệt — đổi phạm vi đi qua quy trình duyệt (T11.5b), không ở đây.
      if (dto.visibility !== undefined || dto.classId !== undefined) {
        throw new ForbiddenException('Dự án đang công khai — đổi phạm vi cần giáo viên');
      }
    }

    const visibility = dto.visibility ?? access.visibility;
    let classId = access.classId;
    if (visibility !== 'class') {
      if (dto.classId) throw new BadRequestException('Chỉ chọn lớp khi chia sẻ trong lớp');
      classId = null;
    } else if (dto.classId !== undefined) {
      classId = dto.classId;
    }
    const scopeChanged = visibility !== access.visibility || classId !== access.classId;
    if (visibility === 'class' && scopeChanged) {
      if (!classId) throw new BadRequestException('Cần chọn lớp để chia sẻ');
      // Chỉ chia sẻ vào lớp mình đang học/dạy — không đẩy dự án vào lớp người khác.
      if (!(await this.access.belongsToClass(classId, actor.userId))) {
        throw new ForbiddenException('Bạn không thuộc lớp này');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.scratchProject.update({
        where: { id: projectId },
        data: { ...(dto.title !== undefined ? { title: dto.title.trim() } : {}), visibility, classId },
      });
      if (scopeChanged) {
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: 'scratch.project.share',
            entity: 'ScratchProject',
            entityId: projectId,
            metaJson: { from: access.visibility, to: visibility, fromClassId: access.classId, toClassId: classId },
            ip: actor.ip,
          },
        });
      }
    });
    return this.detail(projectId, actor.userId);
  }

  /** Xóa mềm — bài đã nộp vẫn trỏ được phiên bản đóng băng. Chỉ chủ dự án. */
  async remove(projectId: string, actor: ScratchActor): Promise<void> {
    await this.access.owned(projectId, actor.userId);
    await this.prisma.$transaction([
      this.prisma.scratchProject.update({ where: { id: projectId }, data: { deletedAt: new Date() } }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'scratch.project.delete',
          entity: 'ScratchProject',
          entityId: projectId,
          ip: actor.ip,
        },
      }),
    ]);
  }

  async listVersions(projectId: string, userId: string): Promise<ScratchProjectVersionDto[]> {
    await this.access.editable(projectId, userId);
    const rows = await this.prisma.scratchProjectVersion.findMany({
      where: { projectId },
      select: { id: true, seq: true, sizeBytes: true, frozenAt: true, savedById: true, createdAt: true },
      orderBy: { seq: 'desc' },
    });
    return rows.map(toVersionDto);
  }

  /**
   * Lưu một phiên bản mới (bất biến) — chủ hoặc đồng tác giả. Trong cùng transaction: gắn các asset ĐÃ
   * có trên server mà project.json tham chiếu (md5ext không có trên server = asset thư viện Scratch, tải
   * từ CDN), rồi dọn bản chưa đóng băng cũ hơn SCRATCH_KEEP_UNFROZEN_VERSIONS bản gần nhất.
   */
  async saveVersion(projectId: string, buffer: Buffer | undefined, userId: string): Promise<ScratchProjectVersionDto> {
    await this.access.editable(projectId, userId);
    const parsed = parseProjectJson(buffer);

    for (let attempt = 1; ; attempt++) {
      try {
        const version = await this.prisma.$transaction(async (tx) => {
          const last = await tx.scratchProjectVersion.findFirst({
            where: { projectId },
            select: { seq: true },
            orderBy: { seq: 'desc' },
          });
          const seq = (last?.seq ?? 0) + 1;
          const created = await tx.scratchProjectVersion.create({
            data: {
              projectId,
              seq,
              projectJson: parsed.json as Prisma.InputJsonObject,
              sizeBytes: parsed.sizeBytes,
              savedById: userId,
            },
          });
          if (parsed.md5exts.length > 0) {
            const known = await tx.scratchAsset.findMany({
              where: { md5ext: { in: parsed.md5exts } },
              select: { md5ext: true },
            });
            await tx.scratchProjectAsset.createMany({
              data: known.map((a) => ({ projectId, md5ext: a.md5ext })),
              skipDuplicates: true,
            });
          }
          await tx.scratchProjectVersion.deleteMany({
            where: { projectId, frozenAt: null, seq: { lte: seq - SCRATCH_KEEP_UNFROZEN_VERSIONS } },
          });
          await tx.scratchProject.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
          return created;
        });
        return toVersionDto(version);
      } catch (e) {
        const seqTaken = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!seqTaken) throw e;
        if (attempt >= SAVE_ATTEMPTS) throw new ConflictException('Dự án đang được lưu ở nơi khác, thử lại');
      }
    }
  }

  /** project.json của một phiên bản (`latest` = mới nhất) — ai xem được dự án đều đọc được. */
  async versionJson(projectId: string, seq: number | 'latest', userId: string): Promise<unknown> {
    await this.access.readable(projectId, userId);
    const version = await this.prisma.scratchProjectVersion.findFirst({
      where: { projectId, ...(seq === 'latest' ? {} : { seq }) },
      select: { projectJson: true },
      orderBy: { seq: 'desc' },
    });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại');
    return version.projectJson;
  }

  /**
   * Asset private của dự án (ADR D7): chỉ phục vụ khi người xem đọc được dự án VÀ dự án tham chiếu asset
   * đó. Asset không thuộc dự án ⇒ 404 — trình soạn sẽ thử CDN thư viện Scratch.
   */
  async asset(projectId: string, md5ext: string, userId: string): Promise<ScratchAssetDownload> {
    await this.access.readable(projectId, userId);
    const link = await this.prisma.scratchProjectAsset.findUnique({
      where: { projectId_md5ext: { projectId, md5ext } },
      select: { asset: { select: { storageKey: true, mime: true } } },
    });
    if (!link) throw new NotFoundException('Asset không thuộc dự án');
    return { buffer: await this.storage.get(link.asset.storageKey), mime: link.asset.mime };
  }

  private async remixOrigin(remixOfId: string, userId: string): Promise<{ id: string; title: string } | null> {
    try {
      await this.access.readable(remixOfId, userId);
    } catch {
      return null; // bản gốc đã xóa / người xem không được thấy — không lộ tiêu đề
    }
    return this.prisma.scratchProject.findUnique({ where: { id: remixOfId }, select: { id: true, title: true } });
  }

  private withEffectiveVisibility(dto: ScratchProjectSummaryDto): ScratchProjectSummaryDto {
    return { ...dto, visibility: effectiveVisibility(dto.visibility, dto.classId) };
  }
}

function toVersionDto(v: {
  id: string;
  seq: number;
  sizeBytes: number;
  frozenAt: Date | null;
  savedById: string | null;
  createdAt: Date;
}): ScratchProjectVersionDto {
  return {
    id: v.id,
    seq: v.seq,
    sizeBytes: v.sizeBytes,
    frozen: v.frozenAt !== null,
    savedById: v.savedById,
    createdAt: v.createdAt.toISOString(),
  };
}
