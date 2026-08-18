import { Test } from '@nestjs/testing';
import { Prisma } from '@lms/database';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: {
    xpEvent: {
      aggregate: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
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
    });

    expect(tx.xpEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        source: 'lesson_complete',
        sourceId: 'lesson-101',
        amount: 50,
      },
    });
    expect(tx.userStreak.create).toHaveBeenCalled();
    expect(tx.userBadge.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', badgeId: 'b-1' },
    });
    expect(tx.notification.create).toHaveBeenCalled();
  });
});
