import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ScratchVisibilityValue as ScratchVisibility } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

/** Những gì cần để quyết định quyền trên một dự án. */
export interface ScratchProjectAccess {
  id: string;
  ownerId: string;
  visibility: ScratchVisibility;
  classId: string | null;
  isOwner: boolean;
  canEdit: boolean;
}

/**
 * Quyền trên dự án BlockSpace — MỘT chỗ cho mọi route `:id` (INVARIANT #3, sk-idor-enforcement).
 *
 * Xem được ⇔ chủ / đồng tác giả, hoặc theo phạm vi:
 * - `school`, `public`: mọi tài khoản đăng nhập (trang công khai ẩn danh là việc của T11.5b);
 * - `class`: thành viên ĐANG HOẠT ĐỘNG của đúng lớp đó, hoặc người TẠO lớp (GV thường tạo lớp mà không
 *   tự thêm mình làm thành viên — bài học P10). Lớp đã bị xóa (`classId` NULL) ⇒ như `private`;
 * - `private`: chỉ chủ / đồng tác giả.
 * Không xem được ⇒ 404 (không để lộ là dự án có tồn tại). Xem được mà không sửa được ⇒ 403.
 * Dự án đã xóa mềm ⇒ 404 với tất cả.
 */
@Injectable()
export class ScratchAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async readable(projectId: string, userId: string): Promise<ScratchProjectAccess> {
    const project = await this.prisma.scratchProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        classId: true,
        deletedAt: true,
        collaborators: { where: { userId }, select: { userId: true } },
      },
    });
    if (!project || project.deletedAt) throw new NotFoundException('Dự án không tồn tại');

    const isOwner = project.ownerId === userId;
    const canEdit = isOwner || project.collaborators.length > 0;
    const access: ScratchProjectAccess = {
      id: project.id,
      ownerId: project.ownerId,
      visibility: project.visibility,
      classId: project.classId,
      isOwner,
      canEdit,
    };
    if (canEdit || (await this.visibleByScope(project.visibility, project.classId, userId))) return access;
    throw new NotFoundException('Dự án không tồn tại');
  }

  async editable(projectId: string, userId: string): Promise<ScratchProjectAccess> {
    const access = await this.readable(projectId, userId);
    if (!access.canEdit) throw new ForbiddenException('Bạn không được sửa dự án này');
    return access;
  }

  async owned(projectId: string, userId: string): Promise<ScratchProjectAccess> {
    const access = await this.readable(projectId, userId);
    if (!access.isOwner) throw new ForbiddenException('Chỉ chủ dự án được làm việc này');
    return access;
  }

  /** Thành viên đang hoạt động hoặc người tạo lớp — được xem / chia sẻ dự án vào lớp này. */
  async belongsToClass(classId: string, userId: string): Promise<boolean> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { createdById: true, members: { where: { userId }, select: { status: true } } },
    });
    if (!cls) return false;
    return cls.createdById === userId || cls.members[0]?.status === 'active';
  }

  private async visibleByScope(visibility: ScratchVisibility, classId: string | null, userId: string) {
    switch (visibility) {
      case 'school':
      case 'public':
        return true;
      case 'class':
        return classId !== null && this.belongsToClass(classId, userId);
      default:
        return false;
    }
  }
}
