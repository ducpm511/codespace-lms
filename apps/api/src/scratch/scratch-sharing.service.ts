import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { SCRATCH_GALLERY_LIMIT, SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import type {
  ScratchClassDto,
  ScratchGalleryScope,
  ScratchLikeResponse,
  ScratchProjectDetailDto,
  ScratchProjectSummaryDto,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ScratchAccessService } from './scratch-access.service';
import { ScratchProjectsService, effectiveVisibility, summarySelect, toSummary } from './scratch-projects.service';
import { referencedMd5exts } from './project-json';

/**
 * Chia sẻ trong trường (ADR D4′, T11.5): gallery lớp / cả trường, remix (giữ dòng dõi), thích.
 * Mọi thao tác trên MỘT dự án đi qua ScratchAccessService — gallery chỉ liệt kê đúng phạm vi người
 * xem được, không lộ dự án private.
 */
@Injectable()
export class ScratchSharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScratchAccessService,
    private readonly projects: ScratchProjectsService,
  ) {}

  /** Lớp mình chia sẻ vào được / xem gallery được — cùng luật với `ScratchAccessService.belongsToClass`. */
  async myClasses(userId: string): Promise<ScratchClassDto[]> {
    const rows = await this.prisma.class.findMany({
      where: { OR: [{ createdById: userId }, { members: { some: { userId, status: 'active' } } }] },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return rows;
  }

  /**
   * Gallery — chỉ dự án ĐÃ có nội dung, mới cập nhật trước. `class`: phải thuộc lớp đó (403 nếu không).
   * `school`: dự án chia sẻ cả trường (kể cả bản đã duyệt công khai) — mọi tài khoản.
   */
  async gallery(
    scope: ScratchGalleryScope,
    classId: string | undefined,
    userId: string,
  ): Promise<ScratchProjectSummaryDto[]> {
    let where: Prisma.ScratchProjectWhereInput;
    if (scope === 'class') {
      if (!classId) throw new BadRequestException('Cần chọn lớp');
      if (!(await this.access.belongsToClass(classId, userId))) throw new ForbiddenException('Bạn không thuộc lớp này');
      where = { visibility: 'class', classId };
    } else {
      where = { visibility: { in: ['school', 'public'] } };
    }
    const rows = await this.prisma.scratchProject.findMany({
      where: { ...where, deletedAt: null, versions: { some: {} } },
      select: summarySelect(userId),
      orderBy: { updatedAt: 'desc' },
      take: SCRATCH_GALLERY_LIMIT,
    });
    return rows.map((r) => {
      const dto = toSummary(r);
      return { ...dto, visibility: effectiveVisibility(dto.visibility, dto.classId) };
    });
  }

  /**
   * Remix = bản sao RIÊNG của mình từ phiên bản mới nhất, giữ `remixOfId`. Ai xem được dự án đều remix
   * được (kể cả chủ — thành "nhân bản"). Chỉ chép tham chiếu asset mà phiên bản đó dùng — không chép file.
   */
  async remix(sourceId: string, title: string | undefined, userId: string): Promise<ScratchProjectDetailDto> {
    await this.access.readable(sourceId, userId);
    const source = await this.prisma.scratchProject.findUniqueOrThrow({
      where: { id: sourceId },
      select: {
        title: true,
        versions: { select: { projectJson: true, sizeBytes: true }, orderBy: { seq: 'desc' }, take: 1 },
      },
    });
    const latest = source.versions[0];
    if (!latest) throw new BadRequestException('Dự án chưa có nội dung để remix');
    return this.copyVersion(sourceId, source.title, latest, title, userId);
  }

  /**
   * Remix từ trang công khai: chép ĐÚNG bản đã duyệt (không phải bản mới nhất của chủ — có thể chưa ai
   * duyệt). Mọi tài khoản đăng nhập remix được, kể cả không xem được dự án trong LMS.
   */
  async remixPublished(slug: string, userId: string): Promise<ScratchProjectDetailDto> {
    const pub = await this.prisma.scratchPublication.findUnique({
      where: { slug },
      select: {
        projectId: true,
        publishedTitle: true,
        project: { select: { deletedAt: true } },
        publishedVersion: { select: { projectJson: true, sizeBytes: true } },
      },
    });
    if (!pub?.publishedVersion || pub.project.deletedAt) throw new NotFoundException('Dự án không tồn tại');
    return this.copyVersion(pub.projectId, pub.publishedTitle ?? 'BlockSpace', pub.publishedVersion, undefined, userId);
  }

  /** Bản sao RIÊNG (private) của mình từ một phiên bản, giữ `remixOfId`; chỉ chép tham chiếu asset nó dùng. */
  private async copyVersion(
    sourceId: string,
    sourceTitle: string,
    version: { projectJson: Prisma.JsonValue; sizeBytes: number },
    title: string | undefined,
    userId: string,
  ): Promise<ScratchProjectDetailDto> {
    const used = referencedMd5exts(version.projectJson);
    const links = await this.prisma.scratchProjectAsset.findMany({
      where: { projectId: sourceId, md5ext: { in: used } },
      select: { md5ext: true },
    });
    const newTitle = (title?.trim() || `${sourceTitle} (remix)`).slice(0, SCRATCH_TITLE_MAX_LENGTH);

    const created = await this.prisma.$transaction(async (tx) => {
      const project = await tx.scratchProject.create({
        data: { ownerId: userId, title: newTitle, remixOfId: sourceId },
        select: { id: true },
      });
      await tx.scratchProjectVersion.create({
        data: {
          projectId: project.id,
          seq: 1,
          projectJson: version.projectJson as Prisma.InputJsonValue,
          sizeBytes: version.sizeBytes,
          savedById: userId,
        },
      });
      await tx.scratchProjectAsset.createMany({
        data: links.map((l) => ({ projectId: project.id, md5ext: l.md5ext })),
        skipDuplicates: true,
      });
      return project;
    });
    return this.projects.detail(created.id, userId);
  }

  /** Thích / bỏ thích — idempotent (bấm lại hay mạng lặp request đều ra cùng kết quả). */
  async setLike(projectId: string, liked: boolean, userId: string): Promise<ScratchLikeResponse> {
    await this.access.readable(projectId, userId);
    if (liked) {
      await this.prisma.scratchProjectLike.createMany({ data: [{ projectId, userId }], skipDuplicates: true });
    } else {
      await this.prisma.scratchProjectLike.deleteMany({ where: { projectId, userId } });
    }
    const likeCount = await this.prisma.scratchProjectLike.count({ where: { projectId } });
    return { likeCount, likedByMe: liked };
  }
}
