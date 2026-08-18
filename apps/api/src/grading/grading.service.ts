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
   * Dữ liệu do `recomputeClassGradebook` tổng hợp trước đó (khi staff mở sổ điểm / cấp chứng chỉ).
   */
  async getClassGradebook(classId: string, currentUser?: AuthPrincipal): Promise<ClassGradebookDto> {
    await this.assertCanReadGradebook(classId, currentUser);

    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        members: {
          where: { status: 'active' },
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
    if (!cls) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const gradeItems = await this.prisma.gradeItem.findMany({ where: { classId } });
    return this.buildGradebook(
      classId,
      cls.members,
      gradeItems.map((gi) => ({ ...gi, sourceType: gi.sourceType as 'assignment' | 'quiz' | 'coding' })),
    );
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

    // Read-only: học viên xem điểm đã được staff/issue tổng hợp; KHÔNG tự kích hoạt ghi cho cả lớp.
    const fullGradebook = await this.getClassGradebook(classId);
    const myRow = fullGradebook.rows.find((r) => r.userId === currentUser.userId);

    return {
      classId,
      items: fullGradebook.items,
      grades: myRow?.grades || {},
      totalWeightedScore: myRow?.totalWeightedScore || 0,
      completionRate: myRow?.completionRate || 0,
    };
  }

  /** Kiểm quyền đọc sổ điểm lớp: admin/super_admin, grade.read scope lớp, hoặc instructor/ta của lớp. */
  private async assertCanReadGradebook(classId: string, currentUser?: AuthPrincipal): Promise<void> {
    if (!currentUser) return; // gọi nội bộ (student own / issue) — nơi gọi đã tự kiểm quyền

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

    const itemDtos: GradeItemDto[] = gradeItems.map((item) => ({
      id: item.id,
      classId: item.classId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      title: item.title,
      weight: Number(item.weight),
      maxScore: Number(item.maxScore),
    }));

    return { classId, items: itemDtos, rows };
  }

  private async syncGradeItemsForClass(cls: ClassWithCourses): Promise<SyncedGradeItem[]> {
    const itemsToUpsert: Array<{
      sourceType: 'assignment' | 'quiz' | 'coding';
      sourceId: string;
      title: string;
      maxScore: DecimalSource;
    }> = [];

    for (const cc of cls.courses) {
      const c = cc.course;
      for (const a of c.assignments) {
        itemsToUpsert.push({
          sourceType: 'assignment',
          sourceId: a.id,
          title: a.title,
          maxScore: a.maxScore,
        });
      }
      for (const q of c.quizzes) {
        // Calculate actual maxScore from sum of question points (H2 fix)
        const qMax = q.questions.reduce((acc, curr) => acc + Number(curr.points), 0);
        itemsToUpsert.push({
          sourceType: 'quiz',
          sourceId: q.id,
          title: q.title,
          maxScore: qMax > 0 ? qMax : 100,
        });
      }
      for (const cp of c.codingProblems) {
        itemsToUpsert.push({
          sourceType: 'coding',
          sourceId: cp.id,
          title: cp.title,
          maxScore: cp.maxScore,
        });
      }
    }

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

    for (const item of gradeItems) {
      if (item.sourceType === 'assignment') {
        const submissions = await this.prisma.submission.findMany({
          where: {
            assignmentId: item.sourceId,
            classId,
            userId: { in: memberIds },
            status: 'graded',
            score: { not: null },
          },
        });
        for (const sub of submissions) {
          if (sub.score !== null) {
            await this.prisma.gradeEntry.upsert({
              where: { gradeItemId_userId: { gradeItemId: item.id, userId: sub.userId } },
              create: {
                gradeItemId: item.id,
                userId: sub.userId,
                score: sub.score,
                computedAt: new Date(),
              },
              update: {
                score: sub.score,
                computedAt: new Date(),
              },
            });
          }
        }
      } else if (item.sourceType === 'quiz') {
        const attempts = await this.prisma.quizAttempt.findMany({
          where: {
            quizId: item.sourceId,
            classId,
            userId: { in: memberIds },
            status: 'submitted',
            score: { not: null },
          },
          orderBy: { score: 'desc' },
        });
        const bestScorePerUser = new Map<string, Prisma.Decimal>();
        for (const att of attempts) {
          if (att.score !== null && !bestScorePerUser.has(att.userId)) {
            bestScorePerUser.set(att.userId, att.score);
          }
        }
        for (const [uId, score] of bestScorePerUser.entries()) {
          await this.prisma.gradeEntry.upsert({
            where: { gradeItemId_userId: { gradeItemId: item.id, userId: uId } },
            create: {
              gradeItemId: item.id,
              userId: uId,
              score,
              computedAt: new Date(),
            },
            update: {
              score,
              computedAt: new Date(),
            },
          });
        }
      } else if (item.sourceType === 'coding') {
        const codingSubs = await this.prisma.codingSubmission.findMany({
          where: {
            problemId: item.sourceId,
            classId,
            userId: { in: memberIds },
            score: { not: null },
          },
          orderBy: { score: 'desc' },
        });
        const bestScorePerUser = new Map<string, Prisma.Decimal>();
        for (const cs of codingSubs) {
          if (cs.score !== null && !bestScorePerUser.has(cs.userId)) {
            bestScorePerUser.set(cs.userId, cs.score);
          }
        }
        for (const [uId, score] of bestScorePerUser.entries()) {
          await this.prisma.gradeEntry.upsert({
            where: { gradeItemId_userId: { gradeItemId: item.id, userId: uId } },
            create: {
              gradeItemId: item.id,
              userId: uId,
              score,
              computedAt: new Date(),
            },
            update: {
              score,
              computedAt: new Date(),
            },
          });
        }
      }
    }
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
