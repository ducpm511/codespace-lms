import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@lms/database';
import { MANUAL_XP_MAX, MANUAL_XP_MIN, PERMISSIONS } from '@lms/contracts';
import type {
  BadgeDto,
  ClassLeaderboardDto,
  GamificationProfileDto,
  LeaderboardEntryDto,
  LeaderboardWeek,
  ManualAwardRequest,
  ManualAwardResultDto,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import type { AuditActor } from '../common/audit-actor';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac?: RbacService,
  ) {}

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
        // Lời khen của cô giáo là phần thưởng thật sự — đừng để nó chỉ nằm trong thông báo rồi trôi.
        note: ub.note,
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

  /** Huy hiệu giáo viên được phép trao tay (`isManual`). Huy hiệu tự động KHÔNG nằm trong danh sách. */
  async listManualBadges(): Promise<BadgeDto[]> {
    const badges = await this.prisma.badge.findMany({
      where: { isManual: true },
      orderBy: { createdAt: 'asc' },
    });
    return badges.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
    }));
  }

  /**
   * Giáo viên trao huy hiệu / thưởng XP kèm lời nhắn cho MỘT học viên trong MỘT lớp (T10.3).
   *
   * Với trẻ 7–16, lời khen của cô giáo nặng hơn con số hệ thống tự tính — đây là chỗ duy nhất
   * người lớn can thiệp được vào điểm thưởng. Ghi huy hiệu + XP + thông báo + audit trong CÙNG
   * transaction với nhau (INVARIANT #6).
   */
  async awardManually(
    studentId: string,
    dto: ManualAwardRequest,
    actor: AuditActor,
  ): Promise<ManualAwardResultDto> {
    const xpAmount = dto.xpAmount ?? 0;
    const note = dto.note?.trim() || null;

    if (!dto.badgeCode && xpAmount <= 0) {
      throw new BadRequestException('Phải trao huy hiệu hoặc thưởng XP (ít nhất một)');
    }
    if (xpAmount > 0 && (xpAmount < MANUAL_XP_MIN || xpAmount > MANUAL_XP_MAX)) {
      throw new BadRequestException(`XP thưởng phải trong khoảng ${MANUAL_XP_MIN}–${MANUAL_XP_MAX}`);
    }
    if (studentId === actor.userId) {
      throw new ForbiddenException('Không thể tự thưởng cho chính mình');
    }

    await this.assertCanAwardInClass(dto.classId, actor.userId);

    // Học viên phải là thành viên ĐANG HOẠT ĐỘNG của đúng lớp đó — chặn trao xuyên lớp (INVARIANT #3).
    const student = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId: dto.classId, userId: studentId } },
      select: { status: true, roleInClass: true },
    });
    if (!student || student.status !== 'active' || student.roleInClass !== 'student') {
      throw new NotFoundException('Học viên không thuộc lớp này');
    }

    let badge: { id: string; code: string; name: string; description: string; icon: string | null } | null = null;
    if (dto.badgeCode) {
      const found = await this.prisma.badge.findUnique({ where: { code: dto.badgeCode } });
      if (!found) {
        throw new NotFoundException('Huy hiệu không tồn tại');
      }
      // Huy hiệu tự động phải do tiêu chí quyết định — trao tay là đi cửa sau.
      if (!found.isManual) {
        throw new BadRequestException('Huy hiệu này do hệ thống tự trao, không trao tay được');
      }
      const already = await this.prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId: studentId, badgeId: found.id } },
        select: { id: true },
      });
      if (already) {
        throw new ConflictException('Học viên đã có huy hiệu này');
      }
      badge = found;
    }

    const awardedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (badge) {
        await tx.userBadge.create({
          data: {
            userId: studentId,
            badgeId: badge.id,
            awardedById: actor.userId,
            classId: dto.classId,
            note,
            awardedAt,
          },
        });
        await tx.notification.create({
          data: {
            userId: studentId,
            type: 'badge.awarded',
            title: 'Cô/thầy vừa trao cho bạn một huy hiệu! 🏅',
            message: note
              ? `"${badge.name}" — ${note}`
              : `Bạn vừa nhận huy hiệu "${badge.name}": ${badge.description}`,
            payloadJson: { badgeCode: badge.code, badgeName: badge.name, classId: dto.classId },
          },
        });
      }

      if (xpAmount > 0) {
        await tx.xpEvent.create({
          data: {
            userId: studentId,
            source: 'manual_award',
            // Thưởng tay LẶP LẠI được (khác 3 nguồn tự động, vốn khoá theo sourceId của bài).
            // Nên sourceId là id ngẫu nhiên cho từng lượt, không phải id của một bài nào.
            sourceId: randomUUID(),
            amount: xpAmount,
            classId: dto.classId,
            note,
            createdAt: awardedAt,
          },
        });
        await tx.notification.create({
          data: {
            userId: studentId,
            type: 'xp.awarded',
            title: `Bạn được thưởng ${xpAmount} XP! ⭐`,
            message: note ?? 'Cô/thầy ghi nhận nỗ lực của bạn.',
            payloadJson: { xpAmount, classId: dto.classId },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'gamification.award',
          entity: 'User',
          entityId: studentId,
          // Không ghi tên người vào audit (INVARIANT #5) — id là đủ để truy ngược.
          metaJson: { classId: dto.classId, badgeCode: badge?.code ?? null, xpAmount, hasNote: note != null },
          ip: actor.ip,
        },
      });
    });

    return {
      studentId,
      classId: dto.classId,
      badge: badge
        ? {
            id: badge.id,
            code: badge.code,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            awardedAt: awardedAt.toISOString(),
          }
        : null,
      xpAwarded: xpAmount,
      note,
      awardedAt: awardedAt.toISOString(),
    };
  }

  /**
   * Ai được trao thưởng trong lớp này: phải có `grade.write` **và** đang là instructor/ta CỦA CHÍNH
   * LỚP ĐÓ.
   *
   * Chỉ kiểm `grade.write` là chưa đủ: role `instructor` hiện được gán ở phạm vi GLOBAL (nợ kỹ thuật
   * đã biết), nên một giáo viên bất kỳ sẽ trao được cho học viên lớp người khác. Buộc thêm điều kiện
   * thành viên lớp là chỗ chặn thật (INVARIANT #3).
   */
  private async assertCanAwardInClass(classId: string, actorId: string): Promise<void> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, createdById: true },
    });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }
    if (this.rbac) {
      const eff = await this.rbac.getEffectivePermissions(actorId);
      if (!this.rbac.hasPermission(eff, PERMISSIONS.GRADE_WRITE, classId)) {
        throw new ForbiddenException('Bạn không có quyền chấm bài ở lớp này');
      }
    }

    // Người TẠO lớp cũng là người phụ trách lớp. Không có nhánh này thì tính năng chết ngay với dữ
    // liệu thật: trên DB dev có 20 thành viên lớp và KHÔNG một ai là instructor/ta — giáo viên tạo
    // lớp rồi thêm học viên vào, chứ không tự thêm chính mình. Vẫn là tín hiệu THEO TỪNG LỚP nên
    // không mở đường trao xuyên lớp (INVARIANT #3).
    if (cls.createdById === actorId) {
      return;
    }

    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: actorId } },
      select: { status: true, roleInClass: true },
    });
    const isTeacher =
      member?.status === 'active' && (member.roleInClass === 'instructor' || member.roleInClass === 'ta');
    if (!isTeacher) {
      throw new ForbiddenException('Bạn không phụ trách lớp này');
    }
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

    type Tally = {
      xp: number;
      lessonsCompleted: number;
      quizzesPassed: number;
      codingPassed: number;
      bonusXp: number;
    };
    const tally = new Map<string, Tally>();
    for (const m of members) {
      tally.set(m.userId, { xp: 0, lessonsCompleted: 0, quizzesPassed: 0, codingPassed: 0, bonusXp: 0 });
    }
    for (const e of events) {
      const t = tally.get(e.userId);
      if (!t) continue; // XP của người đã rời lớp — không xếp hạng
      t.xp += e.amount;
      if (e.source === 'lesson_complete') t.lessonsCompleted += 1;
      else if (e.source === 'quiz_pass') t.quizzesPassed += 1;
      else if (e.source === 'coding_pass') t.codingPassed += 1;
      // Thưởng tay đếm theo SỐ XP chứ không theo số lượt: "3 lượt khen" không nói lên điều gì.
      else if (e.source === 'manual_award') t.bonusXp += e.amount;
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
      bonusXp: r.bonusXp,
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
