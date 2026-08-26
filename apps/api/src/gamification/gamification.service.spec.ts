import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@lms/database';
import { GamificationService, weekWindowVn } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

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
      findUnique: jest.Mock;
    };
    class: {
      findUnique: jest.Mock;
    };
    userBadge: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    userStreak: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    badge: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let rbac: { getEffectivePermissions: jest.Mock; hasPermission: jest.Mock };

  beforeEach(async () => {
    rbac = {
      getEffectivePermissions: jest.fn().mockResolvedValue({ global: new Set(), byClass: new Map() }),
      hasPermission: jest.fn().mockReturnValue(true),
    };
    prisma = {
      xpEvent: {
        aggregate: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      classMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      class: {
        findUnique: jest.fn(),
      },
      auditLog: {
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
        findUnique: jest.fn(),
      },
      badge: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (client: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: RbacService, useValue: rbac },
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


    it('XP cô/thầy thưởng tay tách riêng, KHÔNG đội số ô đếm nỗ lực', async () => {
      prisma.classMember.findMany.mockResolvedValue(members);
      prisma.xpEvent.findMany.mockResolvedValue([
        { userId: 'u1', source: 'lesson_complete', amount: 50 },
        { userId: 'u1', source: 'manual_award', amount: 30 },
        { userId: 'u2', source: 'manual_award', amount: 25 },
      ]);

      const res = await service.getClassLeaderboard('class-1', 'u1', 'current');
      const u1 = res.entries.find((e) => e.userId === 'u1');
      const u2 = res.entries.find((e) => e.userId === 'u2');

      expect(u1).toMatchObject({ xp: 80, lessonsCompleted: 1, bonusXp: 30 });
      // u2 chỉ có XP thưởng: ba ô đếm đều 0 nhưng bonusXp nói rõ 25 XP đến từ đâu.
      expect(u2).toMatchObject({ xp: 25, lessonsCompleted: 0, quizzesPassed: 0, codingPassed: 0, bonusXp: 25 });
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

  // --- T10.3 — giáo viên trao thưởng thủ công ---

  describe('awardManually', () => {
    const actor = { userId: 'teacher-1', ip: '10.0.0.1' };
    const manualBadge = {
      id: 'b-manual',
      code: 'helping_hand',
      name: 'Giúp bạn',
      description: 'Chủ động giúp bạn trong lớp học',
      icon: 'ph-hand-heart',
      isManual: true,
    };

    type MemberWhere = { where: { classId_userId: { userId: string } } };

    /** Mặc định: GV phụ trách lớp, học viên là thành viên active, chưa có huy hiệu. */
    function happyPath() {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'someone-else' });
      prisma.classMember.findUnique.mockImplementation((args: MemberWhere) =>
        Promise.resolve(
          args.where.classId_userId.userId === 'teacher-1'
            ? { status: 'active', roleInClass: 'instructor' }
            : { status: 'active', roleInClass: 'student' },
        ),
      );
      prisma.badge.findUnique.mockResolvedValue(manualBadge);
      prisma.userBadge.findUnique.mockResolvedValue(null);
    }

    it('ghi huy hiệu + XP + 2 thông báo + audit trong CÙNG transaction', async () => {
      happyPath();

      const res = await service.awardManually(
        'student-1',
        { classId: 'cl1', badgeCode: 'helping_hand', xpAmount: 50, note: 'Hôm nay con giúp bạn rất nhiều' },
        actor,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.userBadge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'student-1',
            badgeId: 'b-manual',
            awardedById: 'teacher-1',
            classId: 'cl1',
            note: 'Hôm nay con giúp bạn rất nhiều',
          }),
        }),
      );
      // XP thưởng tay phải gắn lớp, nếu không nó vô hình với bảng xếp hạng tuần (T10.1).
      expect(prisma.xpEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'student-1',
            source: 'manual_award',
            amount: 50,
            classId: 'cl1',
            note: 'Hôm nay con giúp bạn rất nhiều',
          }),
        }),
      );
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'teacher-1',
            action: 'gamification.award',
            entityId: 'student-1',
          }),
        }),
      );
      expect(res).toMatchObject({ studentId: 'student-1', xpAwarded: 50 });
      expect(res.badge?.code).toBe('helping_hand');
    });

    it('audit KHÔNG chứa nguyên văn lời nhắn, chỉ đánh dấu có hay không', async () => {
      happyPath();
      await service.awardManually(
        'student-1',
        { classId: 'cl1', xpAmount: 20, note: 'Chuyện riêng của lớp' },
        actor,
      );
      const meta = prisma.auditLog.create.mock.calls[0][0].data.metaJson;
      expect(meta).toEqual({ classId: 'cl1', badgeCode: null, xpAmount: 20, hasNote: true });
      expect(JSON.stringify(meta)).not.toContain('Chuyện riêng');
    });

    it('mỗi lượt thưởng XP có sourceId RIÊNG — khen lại lần nữa vẫn cộng', async () => {
      happyPath();
      await service.awardManually('student-1', { classId: 'cl1', xpAmount: 20 }, actor);
      await service.awardManually('student-1', { classId: 'cl1', xpAmount: 20 }, actor);
      const [first, second] = prisma.xpEvent.create.mock.calls;
      expect(first[0].data.sourceId).not.toBe(second[0].data.sourceId);
    });

    it('403 khi GV KHÔNG phụ trách lớp đó — chặn trao xuyên lớp (INVARIANT #3)', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'someone-else' });
      // Có grade.write global (nợ kỹ thuật đã biết) nhưng không phải thành viên lớp.
      rbac.hasPermission.mockReturnValue(true);
      prisma.classMember.findUnique.mockResolvedValue(null);

      await expect(
        service.awardManually('student-1', { classId: 'cl1', xpAmount: 50 }, actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('403 khi là GV của lớp nhưng không có grade.write', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'someone-else' });
      rbac.hasPermission.mockReturnValue(false);

      await expect(
        service.awardManually('student-1', { classId: 'cl1', xpAmount: 50 }, actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 khi học viên không thuộc lớp', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'someone-else' });
      prisma.classMember.findUnique.mockImplementation((args: MemberWhere) =>
        Promise.resolve(
          args.where.classId_userId.userId === 'teacher-1'
            ? { status: 'active', roleInClass: 'instructor' }
            : null,
        ),
      );

      await expect(
        service.awardManually('outsider', { classId: 'cl1', xpAmount: 50 }, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 khi đích đến là GV/TA chứ không phải học viên', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'someone-else' });
      prisma.classMember.findUnique.mockResolvedValue({ status: 'active', roleInClass: 'instructor' });

      await expect(
        service.awardManually('teacher-2', { classId: 'cl1', xpAmount: 50 }, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 khi trao huy hiệu TỰ ĐỘNG bằng tay', async () => {
      happyPath();
      prisma.badge.findUnique.mockResolvedValue({ ...manualBadge, code: 'streak_7', isManual: false });

      await expect(
        service.awardManually('student-1', { classId: 'cl1', badgeCode: 'streak_7' }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('409 khi học viên đã có huy hiệu đó', async () => {
      happyPath();
      prisma.userBadge.findUnique.mockResolvedValue({ id: 'ub-1' });

      await expect(
        service.awardManually('student-1', { classId: 'cl1', badgeCode: 'helping_hand' }, actor),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('400 khi không trao huy hiệu lẫn XP', async () => {
      await expect(
        service.awardManually('student-1', { classId: 'cl1' }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.class.findUnique).not.toHaveBeenCalled();
    });

    it('400 khi XP vượt trần — một lượt thưởng không được lật cả bảng xếp hạng', async () => {
      await expect(
        service.awardManually('student-1', { classId: 'cl1', xpAmount: 5000 }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });


    it('người TẠO lớp trao được dù không phải thành viên lớp', async () => {
      // Dữ liệu thật: GV tạo lớp rồi thêm học viên, KHÔNG tự thêm mình làm thành viên.
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'teacher-1' });
      prisma.classMember.findUnique.mockImplementation((args: MemberWhere) =>
        Promise.resolve(
          args.where.classId_userId.userId === 'student-1'
            ? { status: 'active', roleInClass: 'student' }
            : null,
        ),
      );

      await expect(
        service.awardManually('student-1', { classId: 'cl1', xpAmount: 20 }, actor),
      ).resolves.toMatchObject({ xpAwarded: 20 });
    });

    it('người tạo LỚP KHÁC vẫn bị chặn — createdById là tín hiệu theo từng lớp', async () => {
      prisma.class.findUnique.mockResolvedValue({ id: 'cl1', createdById: 'teacher-khac' });
      prisma.classMember.findUnique.mockResolvedValue(null);

      await expect(
        service.awardManually('student-1', { classId: 'cl1', xpAmount: 20 }, actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 khi tự thưởng cho chính mình', async () => {
      await expect(
        service.awardManually('teacher-1', { classId: 'cl1', xpAmount: 50 }, actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
