import { HttpException, HttpStatus } from '@nestjs/common';
import { SCRATCH_COMMENT_PER_HOUR, SCRATCH_COMMENT_PER_MINUTE, SCRATCH_REPORT_PER_HOUR } from '@lms/contracts';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Giới hạn tần suất BlockSpace (T11.8) — đếm thẳng trong DB (một tiến trình API, không Redis). Mục tiêu là
 * chặn spam / bắt nạt dồn dập, không phải chặn trò chuyện: con số rộng hơn nhiều so với tay trẻ gõ thật.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function tooMany(message: string): HttpException {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

export async function assertCommentQuota(prisma: PrismaService, authorId: string, now = Date.now()): Promise<void> {
  const [lastMinute, lastHour] = await Promise.all([
    prisma.scratchComment.count({ where: { authorId, createdAt: { gte: new Date(now - MINUTE) } } }),
    prisma.scratchComment.count({ where: { authorId, createdAt: { gte: new Date(now - HOUR) } } }),
  ]);
  if (lastMinute >= SCRATCH_COMMENT_PER_MINUTE) throw tooMany('Em bình luận nhanh quá — đợi một chút rồi gửi tiếp nhé');
  if (lastHour >= SCRATCH_COMMENT_PER_HOUR) throw tooMany('Em đã bình luận nhiều trong giờ này — nghỉ một lát nhé');
}

/** Báo cáo dự án + báo cáo bình luận tính chung (báo lại cũng tính — cập nhật làm mới `createdAt`). */
export async function assertReportQuota(prisma: PrismaService, reporterId: string, now = Date.now()): Promise<void> {
  const since = new Date(now - HOUR);
  const [projects, comments] = await Promise.all([
    prisma.scratchReport.count({ where: { reporterId, createdAt: { gte: since } } }),
    prisma.scratchCommentReport.count({ where: { reporterId, createdAt: { gte: since } } }),
  ]);
  if (projects + comments >= SCRATCH_REPORT_PER_HOUR) {
    throw tooMany('Em đã gửi nhiều báo cáo trong giờ này — thầy cô sẽ xem các báo cáo trước nhé');
  }
}
