import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SCRATCH_COMMENT_MAX_LENGTH, SCRATCH_COMMENT_PER_MINUTE } from '@lms/contracts';
import { ScratchCommentsService } from './scratch-comments.service';
import { ScratchCommentModerationService } from './scratch-comment-moderation.service';
import type { ScratchAccessService } from './scratch-access.service';
import type { ScratchModeratorsService } from './scratch-moderators.service';
import type { PrismaService } from '../prisma/prisma.service';

const ME = { userId: 'kid', ip: '1.1.1.1' };

describe('ScratchCommentsService', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let tx: Record<string, Record<string, jest.Mock>>;
  let access: { readable: jest.Mock; owned: jest.Mock };
  let moderators: { canModerate: jest.Mock; isGlobalModerator: jest.Mock };
  let service: ScratchCommentsService;

  const project = (over: Record<string, unknown> = {}) => ({
    ownerId: 'owner',
    visibility: 'class',
    classId: 'c1',
    commentsEnabled: true,
    ...over,
  });
  const comment = (over: Record<string, unknown> = {}) => ({
    authorId: 'author',
    projectId: 'p1',
    deletedAt: null,
    project: { ownerId: 'owner' },
    ...over,
  });

  beforeEach(() => {
    tx = {
      scratchComment: { update: jest.fn() },
      scratchCommentReport: { updateMany: jest.fn() },
      scratchProject: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      scratchProject: { findUniqueOrThrow: jest.fn().mockResolvedValue(project()) },
      scratchComment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(comment()),
        create: jest.fn().mockResolvedValue({ id: 'cm1', createdAt: new Date(), author: { fullName: 'An' } }),
        count: jest.fn().mockResolvedValue(0),
      },
      scratchBannedWord: { findMany: jest.fn().mockResolvedValue([{ word: 'đm' }, { word: 'óc chó' }]) },
      scratchReport: { count: jest.fn().mockResolvedValue(0) },
      scratchCommentReport: { count: jest.fn().mockResolvedValue(0), upsert: jest.fn() },
    };
    Object.assign(prisma, { $transaction: jest.fn().mockImplementation((fn: (t: unknown) => unknown) => fn(tx)) });
    access = { readable: jest.fn().mockResolvedValue({ isOwner: false }), owned: jest.fn().mockResolvedValue({}) };
    moderators = { canModerate: jest.fn().mockResolvedValue(false), isGlobalModerator: jest.fn() };
    service = new ScratchCommentsService(
      prisma as unknown as PrismaService,
      access as unknown as ScratchAccessService,
      moderators as unknown as ScratchModeratorsService,
    );
  });

  describe('list', () => {
    it('dự án private (hoặc lớp đã xóa) ⇒ không có bình luận, không truy vấn', async () => {
      for (const p of [project({ visibility: 'private', classId: null }), project({ classId: null })]) {
        prisma.scratchProject.findUniqueOrThrow.mockResolvedValue(p);
        await expect(service.list('p1', 'kid')).resolves.toMatchObject({
          available: false,
          canComment: false,
          items: [],
        });
      }
      expect(prisma.scratchComment.findMany).not.toHaveBeenCalled();
    });

    it('người xem thường KHÔNG nhận bình luận đã ẩn; chủ dự án + GV nhận', async () => {
      await service.list('p1', 'kid');
      expect(prisma.scratchComment.findMany.mock.calls[0][0].where).toEqual({
        projectId: 'p1',
        deletedAt: null,
        hiddenAt: null,
      });
      access.readable.mockResolvedValue({ isOwner: true });
      await service.list('p1', 'owner');
      expect(prisma.scratchComment.findMany.mock.calls[1][0].where).toEqual({ projectId: 'p1', deletedAt: null });
      access.readable.mockResolvedValue({ isOwner: false });
      moderators.canModerate.mockResolvedValue(true);
      await expect(service.list('p1', 'teacher')).resolves.toMatchObject({ canModerate: true });
      expect(prisma.scratchComment.findMany.mock.calls[2][0].where).toEqual({ projectId: 'p1', deletedAt: null });
    });

    it('không xem được dự án ⇒ 404 (không lộ bình luận)', async () => {
      access.readable.mockRejectedValue(new NotFoundException());
      await expect(service.list('p1', 'stranger')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('lưu bình luận đã trim', async () => {
      await expect(service.create('p1', '  Mê cung hay quá!  ', 'kid')).resolves.toMatchObject({
        content: 'Mê cung hay quá!',
        mine: true,
      });
      expect(prisma.scratchComment.create.mock.calls[0][0].data).toEqual({
        projectId: 'p1',
        authorId: 'kid',
        content: 'Mê cung hay quá!',
      });
    });

    it('có từ cấm ⇒ 400 và KHÔNG nói từ nào', async () => {
      const err = await service.create('p1', 'đồ ÓC CHÓ', 'kid').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).not.toMatch(/óc|chó/i);
      expect(prisma.scratchComment.create).not.toHaveBeenCalled();
    });

    it('rỗng / quá dài ⇒ 400; private ⇒ 403; chủ tắt bình luận ⇒ 403 (trừ chủ dự án)', async () => {
      await expect(service.create('p1', '   ', 'kid')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create('p1', 'a'.repeat(SCRATCH_COMMENT_MAX_LENGTH + 1), 'kid')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      prisma.scratchProject.findUniqueOrThrow.mockResolvedValue(project({ visibility: 'private', classId: null }));
      await expect(service.create('p1', 'hi', 'kid')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.scratchProject.findUniqueOrThrow.mockResolvedValue(project({ commentsEnabled: false }));
      await expect(service.create('p1', 'hi', 'kid')).rejects.toBeInstanceOf(ForbiddenException);
      access.readable.mockResolvedValue({ isOwner: true });
      await expect(service.create('p1', 'Cảm ơn các bạn', 'owner')).resolves.toBeDefined();
    });

    it(`quá ${SCRATCH_COMMENT_PER_MINUTE} bình luận / phút ⇒ 429`, async () => {
      prisma.scratchComment.count.mockResolvedValue(SCRATCH_COMMENT_PER_MINUTE);
      await expect(service.create('p1', 'spam', 'kid')).rejects.toMatchObject({ status: 429 });
      expect(prisma.scratchComment.create).not.toHaveBeenCalled();
    });
  });

  describe('xóa / ẩn', () => {
    it('tác giả tự xóa (mềm) + đóng báo cáo + audit KHÔNG có nội dung', async () => {
      await service.remove('cm1', { userId: 'author' });
      expect(tx.scratchComment.update.mock.calls[0][0].data).toMatchObject({ deletedById: 'author' });
      expect(tx.scratchCommentReport.updateMany).toHaveBeenCalled();
      const log = tx.auditLog.create.mock.calls[0][0].data;
      expect(log).toMatchObject({ action: 'scratch.comment.delete', metaJson: { commentId: 'cm1', self: true } });
      expect(JSON.stringify(log)).not.toContain('content');
    });

    it('chủ dự án KHÔNG xóa được (chỉ ẩn); GV xóa được', async () => {
      await expect(service.remove('cm1', { userId: 'owner' })).rejects.toBeInstanceOf(ForbiddenException);
      moderators.canModerate.mockImplementation(async (mod: string) => mod === 'teacher');
      await service.remove('cm1', { userId: 'teacher' });
      expect(tx.auditLog.create.mock.calls[0][0].data.metaJson).toEqual({ commentId: 'cm1', self: false });
    });

    it('chủ dự án ẩn / bỏ ẩn được; người khác (không phải GV) ⇒ 403', async () => {
      await service.setHidden('cm1', true, { userId: 'owner' });
      expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({
        action: 'scratch.comment.hide',
        metaJson: { by: 'owner' },
      });
      await service.setHidden('cm1', false, { userId: 'owner' });
      expect(tx.scratchComment.update.mock.calls[1][0].data).toEqual({ hiddenAt: null, hiddenById: null });
      await expect(service.setHidden('cm1', true, ME)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('GV của NGƯỜI VIẾT (không phải của chủ dự án) cũng ẩn được', async () => {
      moderators.canModerate.mockImplementation(async (_mod: string, student: string) => student === 'author');
      await service.setHidden('cm1', true, { userId: 'author-teacher' });
      expect(tx.auditLog.create.mock.calls[0][0].data.metaJson).toMatchObject({ by: 'moderator' });
    });

    it('bình luận đã xóa / trên dự án không xem được ⇒ 404', async () => {
      prisma.scratchComment.findUnique.mockResolvedValue(comment({ deletedAt: new Date() }));
      await expect(service.setHidden('cm1', true, { userId: 'owner' })).rejects.toBeInstanceOf(NotFoundException);
      prisma.scratchComment.findUnique.mockResolvedValue(comment());
      access.readable.mockRejectedValue(new NotFoundException());
      await expect(service.remove('cm1', { userId: 'author' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('báo cáo: không tự báo cáo mình; báo lại = cập nhật + mở lại; tính hạn mức', async () => {
    await expect(service.report('cm1', { reason: 'other' }, 'author')).rejects.toBeInstanceOf(BadRequestException);
    await service.report('cm1', { reason: 'inappropriate', note: ' bắt nạt ' }, 'kid');
    expect(prisma.scratchCommentReport.upsert.mock.calls[0][0]).toMatchObject({
      where: { commentId_reporterId: { commentId: 'cm1', reporterId: 'kid' } },
      create: { reason: 'inappropriate', note: 'bắt nạt' },
      update: { resolvedAt: null, resolution: null },
    });
    prisma.scratchReport.count.mockResolvedValue(10);
    await expect(service.report('cm1', { reason: 'other' }, 'kid')).rejects.toMatchObject({ status: 429 });
  });

  it('chủ dự án bật / tắt bình luận + audit', async () => {
    await service.setOpen('p1', false, { userId: 'owner' });
    expect(access.owned).toHaveBeenCalledWith('p1', 'owner');
    expect(tx.scratchProject.update.mock.calls[0][0].data).toEqual({ commentsEnabled: false });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.comments.close');
  });

  describe('ScratchCommentModerationService', () => {
    let mod: ScratchCommentModerationService;
    const report = (over: Record<string, unknown> = {}) => ({
      resolvedAt: null,
      commentId: 'cm1',
      comment: comment(),
      ...over,
    });

    beforeEach(() => {
      Object.assign(prisma, {
        scratchCommentReport: { ...prisma.scratchCommentReport, findUnique: jest.fn().mockResolvedValue(report()) },
        scratchBannedWord: { findMany: jest.fn().mockResolvedValue([]) },
      });
      Object.assign(tx, {
        scratchCommentReport: { update: jest.fn(), updateMany: jest.fn() },
        scratchBannedWord: { create: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      });
      mod = new ScratchCommentModerationService(
        prisma as unknown as PrismaService,
        moderators as unknown as ScratchModeratorsService,
        service,
      );
    });

    it('xóa từ báo cáo: xóa mềm bình luận + đóng MỌI báo cáo mở của nó', async () => {
      moderators.canModerate.mockResolvedValue(true);
      await mod.resolveReport('r1', 'delete', { userId: 'teacher' });
      expect(tx.scratchComment.update.mock.calls[0][0].data).toMatchObject({ deletedById: 'teacher' });
      expect(tx.scratchCommentReport.updateMany.mock.calls[0][0]).toMatchObject({
        where: { commentId: 'cm1', resolvedAt: null },
        data: { resolution: 'deleted' },
      });
      expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('scratch.comment.report.delete');
    });

    it('không phải GV ⇒ 403; đã xử lý ⇒ 409', async () => {
      await expect(mod.resolveReport('r1', 'hide', { userId: 'kid' })).rejects.toBeInstanceOf(ForbiddenException);
      moderators.canModerate.mockResolvedValue(true);
      prisma.scratchCommentReport.findUnique.mockResolvedValue(report({ resolvedAt: new Date() }));
      await expect(mod.resolveReport('r1', 'dismiss', { userId: 'teacher' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('từ cấm: chỉ admin; chuẩn hóa trước khi lưu; chỉ dấu câu ⇒ 400', async () => {
      moderators.isGlobalModerator.mockResolvedValue(false);
      await expect(mod.addBannedWord('xấu', { userId: 'teacher' })).rejects.toBeInstanceOf(ForbiddenException);
      moderators.isGlobalModerator.mockResolvedValue(true);
      await mod.addBannedWord('  Đồ   NGỐC ', { userId: 'admin' });
      expect(tx.scratchBannedWord.create.mock.calls[0][0].data).toEqual({ word: 'đồ ngốc', createdById: 'admin' });
      expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'scratch.bannedword.add' });
      await expect(mod.addBannedWord('!!', { userId: 'admin' })).rejects.toBeInstanceOf(BadRequestException);
      await mod.removeBannedWord('ĐỒ NGỐC', { userId: 'admin' });
      expect(tx.scratchBannedWord.deleteMany.mock.calls[0][0]).toEqual({ where: { word: 'đồ ngốc' } });
    });
  });
});
