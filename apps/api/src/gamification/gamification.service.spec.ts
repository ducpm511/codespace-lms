import { Test } from '@nestjs/testing';
import { Prisma } from '@lms/database';
import { GamificationService, weekWindowVn } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: {
    xpEvent: {
      aggregate: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    classMember: {
      findMany: jest.Mock;
    };
    userStreak: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    userBadge: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
    badge: {
      findMany: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      xpEvent: {
        aggregate: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      classMember: {
        findMany: jest.fn(),
      },
      userStreak: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      userBadge: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      badge: {
        findMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const module = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  it('getProfile calculates XP, level, ringTurn and streak correctly', async () => {
    prisma.xpEvent.aggregate.mockResolvedValue({ _sum: { amount: 1250 } });
    prisma.userStreak.findUnique.mockResolvedValue({
      currentStreak: 5,
      longestStreak: 7,
      lastActiveDate: '2026-08-17',
    });
    prisma.userBadge.findMany.mockResolvedValue([
      {
        badgeId: 'b-1',
        awardedAt: new Date('2026-08-15T00:00:00Z'),
        badge: {
          id: 'b-1',
          code: 'first_lesson',
          name: 'Học viên xuất sắc',
          description: 'Hoàn thành bài học đầu tiên',
          icon: 'ph-medal',
        },
      },
    ]);
    prisma.badge.findMany.mockResolvedValue([
      {
        id: 'b-1',
        code: 'first_lesson',
        name: 'Học viên xuất sắc',
        description: 'Hoàn thành bài học đầu tiên',
        icon: 'ph-medal',
      },
      {
        id: 'b-2',
        code: 'streak_3',
        name: 'Chăm chỉ 3 ngày',
        description: 'Duy trì chuỗi học 3 ngày',
        icon: 'ph-fire',
      },
    ]);

    const profile = await service.getProfile('user-1');

    expect(profile.xp.total).toBe(1250);
    expect(profile.xp.level).toBe(3); // 1250 / 500 = 2.5 -> Level 3 (0..499=L1, 500..999=L2, 1000..1499=L3)
    expect(profile.xp.currentLevelXp).toBe(250);
    expect(profile.xp.ringTurn).toBe(0.5);
    expect(profile.streak.current).toBe(5);
    expect(profile.badges).toHaveLength(1);
    expect(profile.badges[0].code).toBe('first_lesson');
    expect(profile.allBadges).toHaveLength(2);
  });

  it('recordLearningActivityInTx updates streak and awards badge when criteria is met', async () => {
    const tx = {
      xpEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50 } }),
      },
      userStreak: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      userBadge: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      badge: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b-1', code: 'first_lesson', name: 'Học viên xuất sắc', description: 'desc' },
        ]),
      },
      notification: {
        create: jest.fn(),
      },
    };

    await service.recordLearningActivityInTx(tx as unknown as Prisma.TransactionClient, {
      userId: 'user-1',
      source: 'lesson_complete',
      sourceId: 'lesson-101',
      xpAmount: 50,
      classId: 'class-1',
    });

    expect(tx.xpEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        source: 'lesson_complete',
        sourceId: 'lesson-101',
        amount: 50,
        classId: 'class-1',
      },
    });
    expect(tx.userStreak.create).toHaveBeenCalled();
    expect(tx.userBadge.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', badgeId: 'b-1' },
    });
    expect(tx.notification.create).toHaveBeenCalled();
  });

  // --- T10.1 — bảng xếp hạng theo lớp / theo tuần ---

  describe('weekWindowVn', () => {
    it('mốc tuần là thứ Hai 00:00 giờ VN = CN 17:00 UTC', () => {
      // 2026-08-26T03:00Z = thứ Tư 10:00 giờ VN → tuần bắt đầu thứ Hai 24/08 giờ VN.
      const { start, end } = weekWindowVn(new Date('2026-08-26T03:00:00.000Z'), 'current');
      expect(start.toISOString()).toBe('2026-08-23T17:00:00.000Z');
      expect(end.toISOString()).toBe('2026-08-30T17:00:00.000Z');
    });

    it('CN 22:00 giờ VN vẫn thuộc tuần đang chạy, chưa nhảy sang tuần mới', () => {
      // 2026-08-30T15:00Z = CN 22:00 giờ VN (vẫn trước nửa đêm VN).
      const { start } = weekWindowVn(new Date('2026-08-30T15:00:00.000Z'), 'current');
      expect(start.toISOString()).toBe('2026-08-23T17:00:00.000Z');
    });

    it('thứ Hai 00:30 giờ VN đã là tuần mới (reset)', () => {
      // 2026-08-30T17:30Z = thứ Hai 31/08 00:30 giờ VN.
      const { start } = weekWindowVn(new Date('2026-08-30T17:30:00.000Z'), 'current');
      expect(start.toISOString()).toBe('2026-08-30T17:00:00.000Z');
    });

    it("week='previous' lùi đúng 7 ngày", () => {
      const { start, end } = weekWindowVn(new Date('2026-08-26T03:00:00.000Z'), 'previous');
      expect(start.toISOString()).toBe('2026-08-16T17:00:00.000Z');
      expect(end.toISOString()).toBe('2026-08-23T17:00:00.000Z');
    });
  });

  describe('getClassLeaderboard', () => {
    const members = [
      { userId: 'u1', user: { fullName: 'An Nguyễn' } },
      { userId: 'u2', user: { fullName: 'Bình Trần' } },
      { userId: 'u3', user: { fullName: 'Cường Lê' } },
    ];

    it('xếp theo XP tuần, đồng điểm đồng hạng, kèm dòng của chính mình', async () => {
      prisma.classMember.findMany.mockResolvedValue(members);
      prisma.xpEvent.findMany.mockResolvedValue([
        { userId: 'u1', source: 'lesson_complete', amount: 50 },
        { userId: 'u1', source: 'quiz_pass', amount: 100 },
        { userId: 'u2', source: 'coding_pass', amount: 100 },
        { userId: 'u3', source: 'lesson_complete', amount: 50 },
        { userId: 'u3', source: 'lesson_complete', amount: 50 },
      ]);

      const res = await service.getClassLeaderboard(
        'class-1',
        'u3',
        'current',
        new Date('2026-08-26T03:00:00.000Z'),
      );

      expect(res.entries.map((e) => [e.userId, e.xp, e.rank])).toEqual([
        ['u1', 150, 1],
        ['u2', 100, 2],
        ['u3', 100, 2], // đồng điểm với u2 → cùng hạng 2
      ]);
      expect(res.entries[0].quizzesPassed).toBe(1);
      expect(res.entries[2].lessonsCompleted).toBe(2);
      expect(res.me?.userId).toBe('u3');
      expect(res.me?.rank).toBe(2);
      expect(res.weekStart).toBe('2026-08-23T17:00:00.000Z');
    });

    it('chỉ đếm XP của lớp đó trong đúng cửa sổ tuần', async () => {
      prisma.classMember.findMany.mockResolvedValue(members);
      prisma.xpEvent.findMany.mockResolvedValue([]);

      await service.getClassLeaderboard(
        'class-1',
        'u1',
        'current',
        new Date('2026-08-26T03:00:00.000Z'),
      );

      expect(prisma.xpEvent.findMany).toHaveBeenCalledWith({
        where: {
          classId: 'class-1',
          userId: { in: ['u1', 'u2', 'u3'] },
          createdAt: {
            gte: new Date('2026-08-23T17:00:00.000Z'),
            lt: new Date('2026-08-30T17:00:00.000Z'),
          },
        },
        select: { userId: true, source: true, amount: true },
      });
    });

    it('chỉ xếp hạng học viên đang hoạt động — GV/TA đứng ngoài', async () => {
      prisma.classMember.findMany.mockResolvedValue([]);

      const res = await service.getClassLeaderboard('class-1', 'teacher-1', 'current');

      expect(prisma.classMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classId: 'class-1', status: 'active', roleInClass: 'student' },
        }),
      );
      expect(res.entries).toEqual([]);
      expect(res.me).toBeNull();
    });

    it('học viên chưa có XP tuần này vẫn có mặt với 0 điểm (thấy được hạng của mình)', async () => {
      prisma.classMember.findMany.mockResolvedValue(members);
      prisma.xpEvent.findMany.mockResolvedValue([
        { userId: 'u1', source: 'lesson_complete', amount: 50 },
      ]);

      const res = await service.getClassLeaderboard('class-1', 'u2', 'current');

      expect(res.entries).toHaveLength(3);
      expect(res.me).toMatchObject({ userId: 'u2', xp: 0, rank: 2 });
    });

    it('bỏ qua XP của người đã rời lớp', async () => {
      prisma.classMember.findMany.mockResolvedValue([members[0]]);
      prisma.xpEvent.findMany.mockResolvedValue([
        { userId: 'u1', source: 'lesson_complete', amount: 50 },
        { userId: 'gone', source: 'quiz_pass', amount: 100 },
      ]);

      const res = await service.getClassLeaderboard('class-1', 'u1', 'current');

      expect(res.entries).toHaveLength(1);
      expect(res.entries[0]).toMatchObject({ userId: 'u1', xp: 50, rank: 1 });
    });
  });
});
