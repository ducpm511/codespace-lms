import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@lms/database';
import { PrismaService } from '../../prisma/prisma.service';
import { RunnerService } from '../runner/runner.types';
import { mapTestCaseStatus, type TestCaseResultStatus } from './autograder.types';

const DEFAULT_STDOUT_LIMIT_BYTES = 64 * 1024;

interface PerTestOutcome {
  testCaseId: string;
  status: TestCaseResultStatus;
  actualStdout: string;
  runtimeMs: number | null;
}

/**
 * Server-side authoritative grader (T3.5 engine, invoked by the queue processor).
 *
 * INVARIANTS:
 *  - Runs ALL test cases (sample + hidden) via the isolated RunnerService — never in-process.
 *  - Score is computed here from DB test-case weights; client/Pyodide results are never trusted.
 *  - TestCaseResult rows + submission update + LessonProgress are written in ONE transaction.
 *  - Code execution happens OUTSIDE the DB transaction (no long-held locks during runs).
 */
@Injectable()
export class AutograderService {
  private readonly logger = new Logger(AutograderService.name);
  private readonly stdoutLimitBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: RunnerService,
    config: ConfigService,
  ) {
    const raw = Number(config.get<string>('CODE_RUNNER_STDOUT_LIMIT_BYTES'));
    this.stdoutLimitBytes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STDOUT_LIMIT_BYTES;
  }

  /** Grade one submission end-to-end. Idempotent per submission via upsert on results. */
  async grade(submissionId: string): Promise<void> {
    const submission = await this.prisma.codingSubmission.findUnique({
      where: { id: submissionId },
      include: { problem: { include: { testCases: { orderBy: { order: 'asc' } } } } },
    });
    if (!submission) {
      this.logger.warn(`grade: submission ${submissionId} not found`);
      return;
    }

    await this.prisma.codingSubmission.update({
      where: { id: submissionId },
      data: { status: 'running' },
    });

    const { problem } = submission;
    try {
      const outcomes: PerTestOutcome[] = [];
      for (const tc of problem.testCases) {
        const output = await this.runner.run({
          language: submission.language,
          sourceCode: submission.sourceCode,
          stdin: tc.stdin,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
          stdoutLimitBytes: this.stdoutLimitBytes,
        });
        outcomes.push({
          testCaseId: tc.id,
          status: mapTestCaseStatus(output, tc.expectedStdout),
          actualStdout: output.stdout,
          runtimeMs: output.runtimeMs,
        });
      }

      const score = computeScore(problem.testCases, outcomes, problem.maxScore);
      const allPassed =
        problem.testCases.length > 0 && outcomes.every((o) => o.status === 'passed');
      const runtimeMs = sumRuntime(outcomes);

      await this.persist(submission, outcomes, {
        status: allPassed ? 'passed' : 'failed',
        score,
        runtimeMs,
      });
    } catch (err) {
      // Infra/runner failure — record error status, keep any prior results, do not crash the worker.
      this.logger.error(`grade ${submissionId} failed: ${(err as Error).message}`);
      await this.prisma.codingSubmission.update({
        where: { id: submissionId },
        data: { status: 'error' },
      });
      throw err;
    }
  }

  private async persist(
    submission: { id: string; userId: string; classId: string | null; problem: { lessonId: string | null } },
    outcomes: PerTestOutcome[],
    summary: { status: 'passed' | 'failed'; score: Prisma.Decimal; runtimeMs: number | null },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const o of outcomes) {
        await tx.testCaseResult.upsert({
          where: { submissionId_testCaseId: { submissionId: submission.id, testCaseId: o.testCaseId } },
          create: {
            submissionId: submission.id,
            testCaseId: o.testCaseId,
            status: o.status,
            actualStdout: o.actualStdout,
            runtimeMs: o.runtimeMs,
          },
          update: {
            status: o.status,
            actualStdout: o.actualStdout,
            runtimeMs: o.runtimeMs,
          },
        });
      }

      await tx.codingSubmission.update({
        where: { id: submission.id },
        data: { status: summary.status, score: summary.score, runtimeMs: summary.runtimeMs },
      });

      // Reflect coding result on lesson progress (never downgrade an already-completed lesson).
      const lessonId = submission.problem.lessonId;
      if (lessonId && submission.classId) {
        const key = {
          userId_lessonId_classId: {
            userId: submission.userId,
            lessonId,
            classId: submission.classId,
          },
        };
        if (summary.status === 'passed') {
          await tx.lessonProgress.upsert({
            where: key,
            create: {
              userId: submission.userId,
              lessonId,
              classId: submission.classId,
              status: 'completed',
              completedAt: new Date(),
            },
            update: { status: 'completed', completedAt: new Date() },
          });
        } else {
          const existing = await tx.lessonProgress.findUnique({ where: key, select: { status: true } });
          if (!existing) {
            await tx.lessonProgress.create({
              data: {
                userId: submission.userId,
                lessonId,
                classId: submission.classId,
                status: 'in_progress',
              },
            });
          } else if (existing.status === 'not_started') {
            await tx.lessonProgress.update({ where: key, data: { status: 'in_progress' } });
          }
        }
      }
    });
  }
}

function sumRuntime(outcomes: PerTestOutcome[]): number | null {
  const vals = outcomes.map((o) => o.runtimeMs).filter((v): v is number => v != null);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
}

/** score = Σ(weight of passed tests) / Σ(all weights) * maxScore, rounded to 2 dp (Decimal). */
export function computeScore(
  testCases: { id: string; weight: Prisma.Decimal }[],
  outcomes: PerTestOutcome[],
  maxScore: Prisma.Decimal,
): Prisma.Decimal {
  const passedIds = new Set(outcomes.filter((o) => o.status === 'passed').map((o) => o.testCaseId));
  let total = new Prisma.Decimal(0);
  let passed = new Prisma.Decimal(0);
  for (const tc of testCases) {
    total = total.add(tc.weight);
    if (passedIds.has(tc.id)) {
      passed = passed.add(tc.weight);
    }
  }
  if (total.isZero()) {
    return new Prisma.Decimal(0).toDecimalPlaces(2);
  }
  return passed.div(total).mul(maxScore).toDecimalPlaces(2);
}
