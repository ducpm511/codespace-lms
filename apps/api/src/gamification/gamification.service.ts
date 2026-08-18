import { Injectable } from '@nestjs/common';
import { Prisma } from '@lms/database';
import type { GamificationProfileDto } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';

// Múi giờ ứng dụng (Asia/Ho_Chi_Minh = UTC+7) — dùng cho mốc "ngày" của streak.
const APP_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Trả 'YYYY-MM-DD' theo giờ VN cho một thời điểm. */
function localDateStr(d: Date): string {
  return new Date(d.getTime() + APP_TZ_OFFSET_MS).toISOString().slice(0, 10);
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
        },
      });
    }

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
