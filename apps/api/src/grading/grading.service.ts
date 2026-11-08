import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import {
  PERMISSIONS,  type ClassGradebookDto,
  type GradeItemDto,
  type StudentGradebookRow,
  type StudentOwnGradebookDto,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPrincipal } from '../auth/auth.types';
import { RbacService } from '../rbac/rbac.service';

/** Nguồn tạo cột điểm của một lớp: mọi bài trong các khóa đã gán. */
const withGradeSources = {
  courses: {
    include: {
      course: {
        include: {
          assignments: true,
          quizzes: { include: { questions: { select: { points: true } } } },
          codingProblems: true,
        },
      },
    },
  },
} satisfies Prisma.ClassInclude;

interface ClassWithCourses {
  id: string;
  courses: Array<{
    course: {
      assignments: Array<{ id: string; title: string; maxScore: Prisma.Decimal }>;
      quizzes: Array<{
        id: string;
        title: string;
        questions: Array<{ points: Prisma.Decimal }>;
      }>;
      codingProblems: Array<{ id: string; title: string; maxScore: Prisma.Decimal }>;
    };
  }>;
}

interface SyncedGradeItem {
  id: string;
  classId: string;
  sourceType: 'assignment' | 'quiz' | 'coding';
  sourceId: string;
  title: string;
  weight: Prisma.Decimal | number;
  maxScore: Prisma.Decimal | number;
}

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  /**
   * Đọc sổ điểm lớp — READ-ONLY, KHÔNG ghi DB (fix review H3: GET không side-effect).
   * Tính thẳng từ bài nộp như sổ của học viên. Trước đây đọc GradeEntry, bảng chỉ cập nhật khi người phụ
   * trách lớp mở sổ (`recompute`), nên GV vừa chấm hay GV lớp khác (chỉ được GET) thấy điểm cũ.
   */
  async getClassGradebook(classId: string, currentUser?: AuthPrincipal): Promise<ClassGradebookDto> {
    await this.assertCanReadGradebook(classId, currentUser);

    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        ...withGradeSources,
        members: {
          where: { status: 'active' },
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const { items, gradesByUser } = await this.computeLiveGrades(cls, cls.members.map((m) => m.userId));
    const rows: StudentGradebookRow[] = cls.members.map((m) => {
      const grades = gradesByUser.get(m.userId) ?? {};
      return {
        userId: m.userId,
        userFullName: m.user.fullName,
        userEmail: m.user.email,
        grades,
        ...this.calculateSummary(items, grades),
      };
    });
    return { classId, items: items.map(toGradeItemDto), rows };
  }

  /**
   * Điểm từng bài (lấy % trên điểm tối đa) của các học viên, tính trực tiếp từ bài nộp. Cho báo cáo lớp,
   * để "Điểm TB" không đứng yên tới khi có người mở sổ. Chỉ đọc; nơi gọi đã kiểm quyền.
   */
  async computeLiveScorePercents(classId: string, userIds: string[]): Promise<number[]> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, include: withGradeSources });
    if (!cls || userIds.length === 0) return [];
    const { items, gradesByUser } = await this.computeLiveGrades(cls, userIds);
    const percents: number[] = [];
    for (const grades of gradesByUser.values()) {
      for (const item of items) {
        const score = grades[item.id];
        if (score !== null && score !== undefined) percents.push((score / (Number(item.maxScore) || 100)) * 100);
      }
    }
    return percents;
  }

  /**
   * Tổng hợp lại sổ điểm từ Submission/QuizAttempt/CodingSubmission (GHI DB — upsert
   * GradeItem/GradeEntry) rồi trả kết quả mới. Chỉ staff của lớp gọi (assertCanReadGradebook).
   * Tách khỏi GET để read không còn side-effect và học viên không kích hoạt ghi cho cả lớp.
   */
  async recomputeClassGradebook(classId: string, currentUser?: AuthPrincipal): Promise<ClassGradebookDto> {
    await this.assertCanReadGradebook(classId, currentUser);

    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        ...withGradeSources,
        members: {
          where: { status: 'active' },
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const gradeItems = await this.syncGradeItemsForClass(cls);
    const memberIds = cls.members.map((m) => m.userId);
    await this.syncGradeEntriesForClass(classId, gradeItems, memberIds);

    return this.buildGradebook(classId, cls.members, gradeItems);
  }

  async getStudentOwnGradebook(classId: string, currentUser: AuthPrincipal): Promise<StudentOwnGradebookDto> {
    // Validate active member
    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: currentUser.userId } },
    });

    if (!member || member.status !== 'active') {
      throw new ForbiddenException('Bạn không phải học viên active của lớp này');
    }

    const cls = await this.prisma.class.findUnique({ where: { id: classId }, include: withGradeSources });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    // Tính trực tiếp từ bài nộp của CHÍNH học viên, không đọc GradeEntry: bảng đó chỉ cập nhật khi staff mở
    // sổ, nên em làm xong vẫn thấy "Chưa có điểm". Vẫn chỉ đọc: học viên không kích hoạt ghi cho cả lớp.
    const { items, gradesByUser } = await this.computeLiveGrades(cls, [currentUser.userId]);
    const grades = gradesByUser.get(currentUser.userId) ?? {};

    return { classId, items: items.map(toGradeItemDto), grades, ...this.calculateSummary(items, grades) };
  }

  /**
   * Cột điểm của lớp + điểm cao nhất của từng người, tính thẳng từ bài nộp. Chỉ đọc. Cột đã có trong sổ
   * giữ id và trọng số GV đặt; cột chưa từng tổng hợp dùng id tạm `<sourceType>:<sourceId>`.
   */
  private async computeLiveGrades(
    cls: ClassWithCourses,
    userIds: string[],
  ): Promise<{ items: SyncedGradeItem[]; gradesByUser: Map<string, Record<string, number | null>> }> {
    const sources = collectGradeSources(cls);
    const saved = await this.prisma.gradeItem.findMany({ where: { classId: cls.id } });
    const savedByKey = new Map(saved.map((gi) => [sourceKey(gi), gi]));
    const items: SyncedGradeItem[] = sources.map((src) => {
      const gi = savedByKey.get(sourceKey(src));
      return {
        id: gi?.id ?? sourceKey(src),
        classId: cls.id,
        sourceType: src.sourceType,
        sourceId: src.sourceId,
        title: src.title,
        weight: gi?.weight ?? 1,
        maxScore: Number(src.maxScore),
      };
    });

    const best = await this.loadBestScores(cls.id, sources, userIds);
    const gradesByUser = new Map<string, Record<string, number | null>>(userIds.map((u) => [u, {}]));
    for (const item of items) {
      for (const [userId, score] of best.get(sourceKey(item)) ?? []) {
        const grades = gradesByUser.get(userId);
        if (grades) grades[item.id] = Number(score);
      }
    }
    return { items, gradesByUser };
  }

  /** Kiểm quyền đọc sổ điểm lớp: admin/super_admin, grade.read scope lớp, hoặc instructor/ta của lớp. */
  private async assertCanReadGradebook(classId: string, currentUser?: AuthPrincipal): Promise<void> {
    if (!currentUser) return; // gọi nội bộ — nơi gọi đã tự kiểm quyền

    // admin/super_admin nhận `grade.read` ở phạm vi GLOBAL nên `hasPermission` đã phủ —
    // không kiểm role thô (AuthPrincipal chỉ có userId).
    const eff = await this.rbac.getEffectivePermissions(currentUser.userId);
    if (this.rbac.hasPermission(eff, PERMISSIONS.GRADE_READ, classId)) return;

    const member = await this.prisma.classMember.findUnique({
      where: { classId_userId: { classId, userId: currentUser.userId } },
    });
    if (!member || (member.roleInClass !== 'instructor' && member.roleInClass !== 'ta')) {
      throw new ForbiddenException('Bạn không có quyền xem sổ điểm của lớp này');
    }
  }

  /** Dựng DTO sổ điểm từ members + gradeItems (đọc GradeEntry hiện có). KHÔNG ghi DB. */
  private async buildGradebook(
    classId: string,
    members: Array<{ userId: string; user: { fullName: string; email: string } }>,
    gradeItems: SyncedGradeItem[],
  ): Promise<ClassGradebookDto> {
    const gradeItemIds = gradeItems.map((gi) => gi.id);
    const entries = gradeItemIds.length
      ? await this.prisma.gradeEntry.findMany({ where: { gradeItemId: { in: gradeItemIds } } })
      : [];

    const userGradesMap = new Map<string, Record<string, number | null>>();
    for (const m of members) {
      userGradesMap.set(m.userId, {});
    }
    for (const entry of entries) {
      const uMap = userGradesMap.get(entry.userId);
      if (uMap) {
        uMap[entry.gradeItemId] = Number(entry.score);
      }
    }

    const rows: StudentGradebookRow[] = members.map((m) => {
      const grades = userGradesMap.get(m.userId) || {};
      const { totalWeightedScore, completionRate } = this.calculateSummary(gradeItems, grades);
      return {
        userId: m.userId,
        userFullName: m.user.fullName,
        userEmail: m.user.email,
        grades,
        totalWeightedScore,
        completionRate,
      };
    });

    const itemDtos: GradeItemDto[] = gradeItems.map(toGradeItemDto);

    return { classId, items: itemDtos, rows };
  }

  private async syncGradeItemsForClass(cls: ClassWithCourses): Promise<SyncedGradeItem[]> {
    const itemsToUpsert = collectGradeSources(cls);

    const syncedItems: SyncedGradeItem[] = [];
    for (const item of itemsToUpsert) {
      const gi = await this.prisma.gradeItem.upsert({
        where: {
          classId_sourceType_sourceId: {
            classId: cls.id,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          },
        },
        create: {
          classId: cls.id,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          title: item.title,
          maxScore: new Prisma.Decimal(item.maxScore as string | number),
        },
        update: {
          title: item.title,
          maxScore: new Prisma.Decimal(item.maxScore as string | number),
        },
      });
      syncedItems.push({
        ...gi,
        sourceType: gi.sourceType as 'assignment' | 'quiz' | 'coding',
      });
    }

    return syncedItems;
  }

  private async syncGradeEntriesForClass(
    classId: string,
    gradeItems: SyncedGradeItem[],
    memberIds: string[],
  ): Promise<void> {
    if (memberIds.length === 0 || gradeItems.length === 0) return;

    const best = await this.loadBestScores(classId, gradeItems, memberIds);
    for (const item of gradeItems) {
      for (const [userId, score] of best.get(sourceKey(item)) ?? []) {
        await this.prisma.gradeEntry.upsert({
          where: { gradeItemId_userId: { gradeItemId: item.id, userId } },
          create: { gradeItemId: item.id, userId, score, computedAt: new Date() },
          update: { score, computedAt: new Date() },
        });
      }
    }
  }

  /**
   * Điểm cao nhất của từng người trên từng bài, theo sourceKey. Nguồn sự thật duy nhất cho điểm: bài tập đã
   * chấm, lượt quiz đã nộp, bài lập trình đã có điểm. Sổ của staff và của học viên đều đi qua đây nên không lệch nhau.
   */
  private async loadBestScores(
    classId: string,
    sources: Array<Pick<GradeSource, 'sourceType' | 'sourceId'>>,
    userIds: string[],
  ): Promise<Map<string, Map<string, Prisma.Decimal>>> {
    const idsOf = (type: GradeSource['sourceType']) =>
      sources.filter((s) => s.sourceType === type).map((s) => s.sourceId);
    const scoped = { classId, userId: { in: userIds }, score: { not: null } };

    const [submissions, attempts, codingSubs] = await Promise.all([
      this.prisma.submission.findMany({
        where: { ...scoped, assignmentId: { in: idsOf('assignment') }, status: 'graded' },
        select: { assignmentId: true, userId: true, score: true },
      }),
      this.prisma.quizAttempt.findMany({
        where: { ...scoped, quizId: { in: idsOf('quiz') }, status: 'submitted' },
        select: { quizId: true, userId: true, score: true },
      }),
      this.prisma.codingSubmission.findMany({
        where: { ...scoped, problemId: { in: idsOf('coding') } },
        select: { problemId: true, userId: true, score: true },
      }),
    ]);

    const best = new Map<string, Map<string, Prisma.Decimal>>();
    const record = (sourceType: GradeSource['sourceType'], sourceId: string, userId: string, raw: Prisma.Decimal | null) => {
      if (raw === null) return;
      const score = new Prisma.Decimal(raw);
      const key = sourceKey({ sourceType, sourceId });
      const perUser = best.get(key) ?? new Map<string, Prisma.Decimal>();
      const current = perUser.get(userId);
      if (!current || score.gt(current)) perUser.set(userId, score);
      best.set(key, perUser);
    };
    for (const s of submissions) record('assignment', s.assignmentId, s.userId, s.score);
    for (const a of attempts) record('quiz', a.quizId, a.userId, a.score);
    for (const c of codingSubs) record('coding', c.problemId, c.userId, c.score);
    return best;
  }

  private calculateSummary(
    items: SyncedGradeItem[],
    grades: Record<string, number | null>,
  ): { totalWeightedScore: number; completionRate: number } {
    if (items.length === 0) {
      return { totalWeightedScore: 0, completionRate: 0 };
    }

    let totalWeight = 0;
    let weightedScoreSum = 0;
    let completedCount = 0;

    for (const item of items) {
      const weight = Number(item.weight);
      const maxScore = Number(item.maxScore) || 100;
      const score = grades[item.id];

      if (score !== null && score !== undefined) {
        completedCount++;
        const percentage = (score / maxScore) * 100;
        weightedScoreSum += percentage * weight;
      }
      totalWeight += weight;
    }

    const totalWeightedScore = totalWeight > 0 ? Math.round((weightedScoreSum / totalWeight) * 100) / 100 : 0;
    const completionRate = Math.round((completedCount / items.length) * 100);

    return { totalWeightedScore, completionRate };
  }
}

type DecimalSource = string | number | Prisma.Decimal;

interface GradeSource {
  sourceType: 'assignment' | 'quiz' | 'coding';
  sourceId: string;
  title: string;
  maxScore: DecimalSource;
}

function sourceKey(source: { sourceType: string; sourceId: string }): string {
  return `${source.sourceType}:${source.sourceId}`;
}

function collectGradeSources(cls: ClassWithCourses): GradeSource[] {
  const sources: GradeSource[] = [];
  for (const cc of cls.courses) {
    const c = cc.course;
    for (const a of c.assignments) {
      sources.push({ sourceType: 'assignment', sourceId: a.id, title: a.title, maxScore: a.maxScore });
    }
    for (const q of c.quizzes) {
      // Calculate actual maxScore from sum of question points (H2 fix)
      const qMax = q.questions.reduce((acc, curr) => acc + Number(curr.points), 0);
      sources.push({ sourceType: 'quiz', sourceId: q.id, title: q.title, maxScore: qMax > 0 ? qMax : 100 });
    }
    for (const cp of c.codingProblems) {
      sources.push({ sourceType: 'coding', sourceId: cp.id, title: cp.title, maxScore: cp.maxScore });
    }
  }
  return sources;
}

function toGradeItemDto(item: SyncedGradeItem): GradeItemDto {
  return {
    id: item.id,
    classId: item.classId,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    weight: Number(item.weight),
    maxScore: Number(item.maxScore),
  };
}
