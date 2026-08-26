import { Injectable } from '@nestjs/common';
import { Prisma } from '@lms/database';
import type {
  ClassLeaderboardDto,
  GamificationProfileDto,
  LeaderboardEntryDto,
  LeaderboardWeek,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

// Múi giờ ứng dụng (Asia/Ho_Chi_Minh = UTC+7) — dùng cho mốc "ngày" của streak.
const APP_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Trả 'YYYY-MM-DD' theo giờ VN cho một thời điểm. */
function localDateStr(d: Date): string {
  return new Date(d.getTime() + APP_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Nửa khoảng [start, end) của tuần chứa `now`, mốc là **thứ Hai 00:00 giờ VN**.
 * Trả về Date theo UTC để so trực tiếp với `XpEvent.createdAt`.
 *
 * Xếp hạng reset mỗi tuần là CHỦ Ý (T10.1): bảng tích luỹ vĩnh viễn thì học viên vào sau
 * không bao giờ đuổi kịp và sẽ bỏ cuộc.
 */
export function weekWindowVn(now: Date, week: LeaderboardWeek): { start: Date; end: Date } {
  const local = new Date(now.getTime() + APP_TZ_OFFSET_MS);
  // getUTCDay() trên mốc đã dịch = thứ trong tuần theo giờ VN. 0 = CN → 6 ngày kể từ thứ Hai.
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const startLocal = week === 'previous' ? localMonday - 7 * DAY_MS : localMonday;
  const start = new Date(startLocal - APP_TZ_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<GamificationProfileDto> {
    const [xpAggregate, streak, userBadges, allBadges] = await this.prisma.$transaction([
      this.prisma.xpEvent.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.userStreak.findUnique({
        where: { userId },
      }),
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      }),
      this.prisma.badge.findMany({
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalXp = xpAggregate._sum.amount ?? 0;
    const level = Math.floor(totalXp / 500) + 1;
    const currentLevelXp = totalXp % 500;
    const nextLevelXp = 500;
    const progressPercent = Math.round((currentLevelXp / 500) * 100);
    const ringTurn = Math.round((currentLevelXp / 500) * 100) / 100;

    const currentStreak = streak?.currentStreak ?? 0;
    const longestStreak = streak?.longestStreak ?? 0;
    const lastActiveDate = streak?.lastActiveDate ?? null;

    const awardedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

    return {
      streak: {
        current: currentStreak,
        longest: longestStreak,
        lastActiveDate,
      },
      xp: {
        total: totalXp,
        level,
        currentLevelXp,
        nextLevelXp,
        progressPercent,
        ringTurn,
      },
      badges: userBadges.map((ub) => ({
        id: ub.badge.id,
        code: ub.badge.code,
        name: ub.badge.name,
        description: ub.badge.description,
        icon: ub.badge.icon,
        awardedAt: ub.awardedAt.toISOString(),
      })),
      allBadges: allBadges.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        awardedAt: awardedBadgeIds.has(b.id)
          ? userBadges.find((ub) => ub.badgeId === b.id)?.awardedAt.toISOString()
          : null,
      })),
    };
  }

  /**
   * Bảng xếp hạng XP theo TUẦN trong phạm vi MỘT lớp (T10.1).
   *
   * Phạm vi là lớp, không phải toàn hệ thống: lớp 15–30 em thì thứ hạng còn có ý nghĩa, còn xếp
   * hạng toàn trường thì em yếu vĩnh viễn ở đáy. Chỉ số là XP tuần — mà XP chỉ cộng khi HOÀN THÀNH
   * (mức cố định, không theo điểm/tốc độ) nên bảng đo NỖ LỰC, không thưởng cho việc chép bài.
   *
   * Người gọi chịu trách nhiệm kiểm quyền xem lớp (INVARIANT #3).
   */
  async getClassLeaderboard(
    classId: string,
    viewerUserId: string,
    week: LeaderboardWeek,
    now: Date = new Date(),
  ): Promise<ClassLeaderboardDto> {
    const { start, end } = weekWindowVn(now, week);

    // Chỉ học viên đang hoạt động. GV/TA không xếp hạng cùng học viên.
    const members = await this.prisma.classMember.findMany({
      where: { classId, status: 'active', roleInClass: 'student' },
      select: { userId: true, user: { select: { fullName: true } } },
    });

    const empty: ClassLeaderboardDto = {
      classId,
      week,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      entries: [],
      me: null,
    };
    if (members.length === 0) {
      return empty;
    }

    const events = await this.prisma.xpEvent.findMany({
      where: {
        classId,
        userId: { in: members.map((m) => m.userId) },
        createdAt: { gte: start, lt: end },
      },
      select: { userId: true, source: true, amount: true },
    });

    type Tally = { xp: number; lessonsCompleted: number; quizzesPassed: number; codingPassed: number };
    const tally = new Map<string, Tally>();
    for (const m of members) {
      tally.set(m.userId, { xp: 0, lessonsCompleted: 0, quizzesPassed: 0, codingPassed: 0 });
    }
    for (const e of events) {
      const t = tally.get(e.userId);
      if (!t) continue; // XP của người đã rời lớp — không xếp hạng
      t.xp += e.amount;
      if (e.source === 'lesson_complete') t.lessonsCompleted += 1;
      else if (e.source === 'quiz_pass') t.quizzesPassed += 1;
      else if (e.source === 'coding_pass') t.codingPassed += 1;
    }

    const rows = members
      .map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        ...(tally.get(m.userId) as Tally),
      }))
      // Hoà điểm xếp theo tên rồi userId — thứ tự tất định, không phụ thuộc thứ tự DB trả về.
      .sort((a, b) => b.xp - a.xp || a.fullName.localeCompare(b.fullName, 'vi') || a.userId.localeCompare(b.userId));

    const entries: LeaderboardEntryDto[] = rows.map((r, i) => ({
      // Competition ranking: đồng điểm thì đồng hạng (1, 1, 3).
      rank: i > 0 && rows[i - 1].xp === r.xp ? -1 : i + 1,
      userId: r.userId,
      fullName: r.fullName,
      xp: r.xp,
      lessonsCompleted: r.lessonsCompleted,
      quizzesPassed: r.quizzesPassed,
      codingPassed: r.codingPassed,
      isMe: r.userId === viewerUserId,
    }));
    for (let i = 1; i < entries.length; i += 1) {
      if (entries[i].rank === -1) entries[i].rank = entries[i - 1].rank;
    }

    return {
      ...empty,
      entries,
      me: entries.find((e) => e.isMe) ?? null,
    };
  }

  /**
   * Ghi nhận hoạt động học tập trong CÙNG transaction với hành động domain.
   * Cập nhật XpEvent (idempotent), UserStreak, và tự động kiểm tra/trao Badge.
   */
  async recordLearningActivityInTx(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      source: 'lesson_complete' | 'quiz_pass' | 'coding_pass';
      sourceId: string;
      xpAmount: number;
      /** Lớp phát sinh XP — cần cho bảng xếp hạng theo lớp (T10.1). */
      classId?: string | null;
    },
  ): Promise<void> {
    // 1) XpEvent (idempotent)
    const existing = await tx.xpEvent.findUnique({
      where: {
        userId_source_sourceId: {
          userId: data.userId,
          source: data.source,
          sourceId: data.sourceId,
        },
      },
    });

    if (!existing) {
      await tx.xpEvent.create({
        data: {
          userId: data.userId,
          source: data.source,
          sourceId: data.sourceId,
          amount: data.xpAmount,
          classId: data.classId ?? null,
        },
      });
    }
    // Khoá duy nhất là (userId, source, sourceId) — học lại CÙNG bài ở lớp khác KHÔNG cộng XP lần
    // hai (chống farm điểm), nên `classId` giữ nguyên lớp đầu tiên. Cố ý: sửa lại sẽ cho phép
    // chuyển XP cũ sang tuần/lớp mới.

    // 2) UserStreak — mốc "ngày" theo giờ VN (UTC+7) để ranh giới chuỗi khớp nửa đêm địa phương
    const now = new Date();
    const todayStr = localDateStr(now);
    const yesterdayStr = localDateStr(new Date(now.getTime() - 86_400_000));

    const streak = await tx.userStreak.findUnique({
      where: { userId: data.userId },
    });

    let currentStreak = 1;
    let longestStreak = 1;

    if (streak) {
      if (streak.lastActiveDate === todayStr) {
        currentStreak = streak.currentStreak;
        longestStreak = streak.longestStreak;
      } else if (streak.lastActiveDate === yesterdayStr) {
        currentStreak = streak.currentStreak + 1;
        longestStreak = Math.max(streak.longestStreak, currentStreak);
      } else {
        currentStreak = 1;
        longestStreak = Math.max(streak.longestStreak, 1);
      }
      await tx.userStreak.update({
        where: { userId: data.userId },
        data: {
          currentStreak,
          longestStreak,
          lastActiveDate: todayStr,
        },
      });
    } else {
      await tx.userStreak.create({
        data: {
          userId: data.userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: todayStr,
        },
      });
    }

    // 3) Evaluate Badges
    const userBadges = await tx.userBadge.findMany({
      where: { userId: data.userId },
      include: { badge: { select: { code: true } } },
    });
    const awardedCodes = new Set(userBadges.map((ub) => ub.badge.code));
    const allBadges = await tx.badge.findMany();
    const badgeByCode = new Map(allBadges.map((b) => [b.code, b]));

    const totalXpEvents = await tx.xpEvent.aggregate({
      where: { userId: data.userId },
      _sum: { amount: true },
    });
    const currentTotalXp = totalXpEvents._sum.amount ?? 0;

    const badgesToAward: string[] = [];

    if (data.source === 'lesson_complete' && !awardedCodes.has('first_lesson')) {
      badgesToAward.push('first_lesson');
    }
    if (data.source === 'coding_pass' && !awardedCodes.has('first_code')) {
      badgesToAward.push('first_code');
    }
    if (data.source === 'quiz_pass' && !awardedCodes.has('quiz_master')) {
      badgesToAward.push('quiz_master');
    }
    if (currentStreak >= 3 && !awardedCodes.has('streak_3')) {
      badgesToAward.push('streak_3');
    }
    if (currentStreak >= 7 && !awardedCodes.has('streak_7')) {
      badgesToAward.push('streak_7');
    }
    if (currentTotalXp >= 500 && !awardedCodes.has('xp_500')) {
      badgesToAward.push('xp_500');
    }

    for (const code of badgesToAward) {
      const badge = badgeByCode.get(code);
      if (badge) {
        await tx.userBadge.create({
          data: { userId: data.userId, badgeId: badge.id },
        });
        await tx.notification.create({
          data: {
            userId: data.userId,
            type: 'badge.awarded',
            title: 'Huy hiệu mới đạt được! 🏆',
            message: `Chúc mừng bạn đã đạt huy hiệu "${badge.name}": ${badge.description}`,
            payloadJson: { badgeCode: badge.code, badgeName: badge.name },
          },
        });
      }
    }
  }
}
