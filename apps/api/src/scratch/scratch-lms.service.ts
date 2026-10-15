import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import { PERMISSIONS, SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import type { OpenScratchActivityResponse } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../common/storage/storage.interface';
import { ScratchAccessService } from './scratch-access.service';
import type { ScratchAssetDownload } from './scratch-projects.service';
import { referencedMd5exts } from './project-json';

/**
 * BlockSpace trong LMS (T11.7 — ADR D6):
 * - hoạt động bài học `scratch`: mỗi học viên MỘT bản sao riêng (private) của dự án mẫu GV gắn;
 * - bài tập nộp `scratch`: nộp = ĐÓNG BĂNG phiên bản mới nhất (autosave không dọn được, học viên sửa tiếp
 *   không đổi bài đã nộp);
 * - GV xem bài nộp qua submission (dự án của em vẫn private — GV KHÔNG có quyền mở dự án trong LMS).
 */
@Injectable()
export class ScratchLmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScratchAccessService,
    private readonly rbac: RbacService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  /**
   * Mở hoạt động: trả bản sao của mình, chưa có thì tạo. Cùng luật với bài tập/quiz: thành viên đang hoạt động
   * của lớp, khóa của bài đã gán cho lớp, bài đã mở gate (INVARIANT #3). Idempotent — bấm 2 lần không ra 2 bản.
   */
  async openActivity(activityId: string, classId: string, userId: string): Promise<OpenScratchActivityResponse> {
    const activity = await this.prisma.lessonActivity.findUnique({
      where: { id: activityId },
      select: {
        type: true,
        title: true,
        refId: true,
        lessonId: true,
        lesson: { select: { title: true, section: { select: { courseId: true } } } },
      },
    });
    if (!activity || activity.type !== 'scratch') throw new NotFoundException('Hoạt động không tồn tại');
    await this.ensureLessonOpen(classId, userId, activity.lesson.section.courseId, activity.lessonId);

    const existing = await this.prisma.scratchActivityCopy.findUnique({
      where: { activityId_userId: { activityId, userId } },
      select: { projectId: true, project: { select: { deletedAt: true } } },
    });
    if (existing && !existing.project.deletedAt) return { projectId: existing.projectId, created: false };

    // Mẫu được đọc bằng quyền của HOẠT ĐỘNG (GV đã gắn), không phải quyền xem dự án của học viên.
    let source: { id: string; title: string; version: { projectJson: Prisma.JsonValue; sizeBytes: number } | null } = {
      id: '',
      title: activity.lesson.title,
      version: null,
    };
    if (activity.refId) {
      const template = await this.prisma.scratchProject.findUnique({
        where: { id: activity.refId },
        select: {
          title: true,
          deletedAt: true,
          versions: { select: { projectJson: true, sizeBytes: true }, orderBy: { seq: 'desc' }, take: 1 },
        },
      });
      if (!template || template.deletedAt || !template.versions[0]) {
        throw new NotFoundException('Dự án mẫu không còn — báo giáo viên nhé');
      }
      source = { id: activity.refId, title: template.title, version: template.versions[0] };
    }
    const title = (activity.title?.trim() || source.title).slice(0, SCRATCH_TITLE_MAX_LENGTH);
    const links = source.version
      ? await this.prisma.scratchProjectAsset.findMany({
          where: { projectId: source.id, md5ext: { in: referencedMd5exts(source.version.projectJson) } },
          select: { md5ext: true },
        })
      : [];

    try {
      const projectId = await this.prisma.$transaction(async (tx) => {
        // Bản sao cũ đã bị em xóa (xóa mềm): bỏ liên kết cũ, tạo bản mới.
        if (existing) await tx.scratchActivityCopy.delete({ where: { activityId_userId: { activityId, userId } } });
        const project = await tx.scratchProject.create({ data: { ownerId: userId, title }, select: { id: true } });
        if (source.version) {
          await tx.scratchProjectVersion.create({
            data: {
              projectId: project.id,
              seq: 1,
              projectJson: source.version.projectJson as Prisma.InputJsonValue,
              sizeBytes: source.version.sizeBytes,
              savedById: userId,
            },
          });
          await tx.scratchProjectAsset.createMany({
            data: links.map((l) => ({ projectId: project.id, md5ext: l.md5ext })),
            skipDuplicates: true,
          });
        }
        await tx.scratchActivityCopy.create({ data: { activityId, userId, projectId: project.id } });
        return project.id;
      });
      return { projectId, created: true };
    } catch (e) {
      // Hai request cùng lúc (bấm đúp): request thua trả bản của request thắng.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const won = await this.prisma.scratchActivityCopy.findUniqueOrThrow({
          where: { activityId_userId: { activityId, userId } },
          select: { projectId: true },
        });
        return { projectId: won.projectId, created: false };
      }
      throw e;
    }
  }

  /**
   * Nộp bài: đóng băng phiên bản mới nhất của một dự án mình sửa được (chủ / đồng tác giả). Trả id phiên bản.
   * `tx`: chạy trong transaction của SubmissionsService (đóng băng + ghi bài nộp cùng lúc).
   */
  async freezeLatest(projectId: string, userId: string, tx: Prisma.TransactionClient): Promise<string> {
    await this.access.editable(projectId, userId);
    const latest = await tx.scratchProjectVersion.findFirst({
      where: { projectId },
      select: { id: true, frozenAt: true },
      orderBy: { seq: 'desc' },
    });
    if (!latest) throw new BadRequestException('Dự án chưa lưu lần nào — mở trình soạn, làm rồi lưu trước khi nộp');
    if (!latest.frozenAt) {
      await tx.scratchProjectVersion.update({ where: { id: latest.id }, data: { frozenAt: new Date() } });
    }
    return latest.id;
  }

  /** project.json của bài nộp — học viên nộp bài hoặc người chấm / xem bài nộp của lớp đó. */
  async submissionJson(submissionId: string, userId: string): Promise<unknown> {
    return (await this.submissionVersion(submissionId, userId)).projectJson;
  }

  /** Asset của bài nộp: chỉ asset mà PHIÊN BẢN đã nộp dùng (asset thêm sau khi nộp không lọt ra). */
  async submissionAsset(submissionId: string, md5ext: string, userId: string): Promise<ScratchAssetDownload> {
    const version = await this.submissionVersion(submissionId, userId);
    if (!referencedMd5exts(version.projectJson).includes(md5ext)) {
      throw new NotFoundException('Asset không thuộc bài nộp');
    }
    const link = await this.prisma.scratchProjectAsset.findUnique({
      where: { projectId_md5ext: { projectId: version.projectId, md5ext } },
      select: { asset: { select: { storageKey: true, mime: true } } },
    });
    if (!link) throw new NotFoundException('Asset không thuộc bài nộp');
    return { buffer: await this.storage.get(link.asset.storageKey), mime: link.asset.mime };
  }

  private async submissionVersion(submissionId: string, userId: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        userId: true,
        classId: true,
        scratchVersion: { select: { projectId: true, projectJson: true } },
      },
    });
    if (!sub) throw new NotFoundException('Bài nộp không tồn tại');
    if (sub.userId !== userId) {
      // Cùng luật với SubmissionsService.findOne: quyền đọc / chấm bài nộp THEO LỚP của bài nộp.
      const eff = await this.rbac.getEffectivePermissions(userId);
      const canRead =
        this.rbac.hasPermission(eff, PERMISSIONS.SUBMISSION_READ, sub.classId) ||
        this.rbac.hasPermission(eff, PERMISSIONS.GRADE_WRITE, sub.classId);
      if (!canRead) throw new ForbiddenException('Không có quyền xem bài nộp này');
    }
    if (!sub.scratchVersion) throw new NotFoundException('Bài nộp không có dự án BlockSpace');
    return sub.scratchVersion;
  }

  private async ensureLessonOpen(classId: string, userId: string, courseId: string, lessonId: string) {
    const [member, classCourse, gate] = await Promise.all([
      this.prisma.classMember.findUnique({ where: { classId_userId: { classId, userId } }, select: { status: true } }),
      this.prisma.classCourse.findUnique({ where: { classId_courseId: { classId, courseId } }, select: { id: true } }),
      this.prisma.lessonGate.findUnique({
        where: { classId_lessonId: { classId, lessonId } },
        select: { isActive: true },
      }),
    ]);
    if (member?.status !== 'active') throw new ForbiddenException('Bạn không phải thành viên của lớp này');
    if (!classCourse) throw new NotFoundException('Hoạt động không tồn tại');
    if (!gate?.isActive) throw new ForbiddenException('Bài học chưa được mở cho lớp này');
  }
}
