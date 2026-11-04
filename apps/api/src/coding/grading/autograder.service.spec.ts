import { Prisma } from '@lms/database';
import { ConfigService } from '@nestjs/config';
import { XP_REWARDS } from '@lms/contracts';
import { AutograderService, computeScore } from './autograder.service';
import { mapTestCaseStatus, normalizeOutput } from './autograder.types';
import type { RunnerInput, RunnerOutput, RunnerService } from '../runner/runner.types';

const D = (n: number | string) => new Prisma.Decimal(n);

function okOutput(stdout: string): RunnerOutput {
  return { verdict: 'ok', stdout, stderr: '', exitCode: 0, runtimeMs: 5, memoryKb: 1000, truncated: false };
}

function makeProblem(overrides: Partial<{ lessonId: string | null }> = {}) {
  return {
    id: 'p1',
    lessonId: 'lesson1',
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    maxScore: D(100),
    testCases: [
      { id: 't1', stdin: '1', expectedStdout: '1', kind: 'sample', weight: D(1), order: 0 },
      { id: 't2', stdin: '2', expectedStdout: '2', kind: 'hidden', weight: D(3), order: 1 },
    ],
    ...overrides,
  };
}

function makeTx() {
  return {
    testCaseResult: { upsert: jest.fn() },
    codingSubmission: { update: jest.fn() },
    lessonProgress: {
      upsert: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeService(
  runnerRun: RunnerService['run'],
  submission: unknown,
  tx: ReturnType<typeof makeTx>,
  gamification?: { recordLearningActivityInTx: jest.Mock },
) {
  const prisma = {
    codingSubmission: { findUnique: jest.fn().mockResolvedValue(submission), update: jest.fn() },
    $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };
  const runner: RunnerService = { run: runnerRun };
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AutograderService(prisma as any, runner, config, gamification as any);
  return { service, prisma };
}

describe('AutograderService.grade', () => {
  it('marks submission passed with full score when all tests pass', async () => {
    const submission = { id: 's1', userId: 'u1', classId: 'c1', language: 'python', sourceCode: 'x', problem: makeProblem() };
    const tx = makeTx();
    // runner echoes stdin -> both expected outputs match
    const { service, prisma } = makeService(async (i: RunnerInput) => okOutput(i.stdin), submission, tx);

    await service.grade('s1');

    expect(prisma.codingSubmission.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'running' } });
    expect(tx.testCaseResult.upsert).toHaveBeenCalledTimes(2);
    const finalUpdate = tx.codingSubmission.update.mock.calls[0][0];
    expect(finalUpdate.data.status).toBe('passed');
    expect((finalUpdate.data.score as Prisma.Decimal).toString()).toBe('100');
    // C3: a lesson can hold other activities, so a pass only starts it; the student completes it.
    expect(tx.lessonProgress.upsert).not.toHaveBeenCalled();
    expect(tx.lessonProgress.create).toHaveBeenCalledTimes(1);
    expect(tx.lessonProgress.create.mock.calls[0][0].data.status).toBe('in_progress');
    expect(tx.lessonProgress.create.mock.calls[0][0].data.completedAt).toBeUndefined();
  });

  it('never downgrades or re-stamps an already-completed lesson on a later pass', async () => {
    const submission = { id: 's5', userId: 'u1', classId: 'c1', language: 'python', sourceCode: 'x', problem: makeProblem() };
    const tx = makeTx();
    tx.lessonProgress.findUnique.mockResolvedValue({ status: 'completed' });
    const { service } = makeService(async (i: RunnerInput) => okOutput(i.stdin), submission, tx);

    await service.grade('s5');

    expect(tx.lessonProgress.upsert).not.toHaveBeenCalled();
    expect(tx.lessonProgress.create).not.toHaveBeenCalled();
    expect(tx.lessonProgress.update).not.toHaveBeenCalled();
  });

  it('keeps the coding_pass XP key on a pass and leaves lesson_complete to the student', async () => {
    const submission = { id: 's6', userId: 'u1', classId: 'c1', language: 'python', sourceCode: 'x', problem: makeProblem() };
    const tx = makeTx();
    const recordLearningActivityInTx = jest.fn();
    const { service } = makeService(async (i: RunnerInput) => okOutput(i.stdin), submission, tx, {
      recordLearningActivityInTx,
    });

    await service.grade('s6');

    expect(recordLearningActivityInTx).toHaveBeenCalledTimes(1);
    expect(recordLearningActivityInTx).toHaveBeenCalledWith(tx, {
      userId: 'u1',
      source: 'coding_pass',
      sourceId: 'p1',
      xpAmount: XP_REWARDS.coding_pass,
      classId: 'c1',
    });
  });

  it('marks failed with weighted score and leaves the lesson in progress on partial pass', async () => {
    const problem = makeProblem();
    problem.testCases[1].expectedStdout = '99'; // t2 (weight 3) will fail; t1 (weight 1) passes
    const submission = { id: 's2', userId: 'u1', classId: 'c1', language: 'python', sourceCode: 'x', problem };
    const tx = makeTx();
    const { service } = makeService(async (i: RunnerInput) => okOutput(i.stdin), submission, tx);

    await service.grade('s2');

    const finalUpdate = tx.codingSubmission.update.mock.calls[0][0];
    expect(finalUpdate.data.status).toBe('failed');
    expect((finalUpdate.data.score as Prisma.Decimal).toString()).toBe('25'); // 1/4 * 100
    // not passed -> creates in_progress (no existing row), never upsert-completes
    expect(tx.lessonProgress.upsert).not.toHaveBeenCalled();
    expect(tx.lessonProgress.create).toHaveBeenCalledTimes(1);
    expect(tx.lessonProgress.create.mock.calls[0][0].data.status).toBe('in_progress');
  });

  it('records hidden test failures too (all tests run server-side)', async () => {
    const submission = { id: 's3', userId: 'u1', classId: 'c1', language: 'python', sourceCode: 'x', problem: makeProblem() };
    const tx = makeTx();
    // runner always returns wrong output -> both fail (including hidden t2)
    const { service } = makeService(async () => okOutput('nope'), submission, tx);

    await service.grade('s3');

    const statuses = tx.testCaseResult.upsert.mock.calls.map((c) => c[0].create.status);
    expect(statuses).toEqual(['failed', 'failed']);
    expect(tx.codingSubmission.update.mock.calls[0][0].data.status).toBe('failed');
  });

  it('sets status=error and rethrows when the runner throws', async () => {
    const submission = { id: 's4', userId: 'u1', classId: 'c1', language: 'python', sourceCode: 'x', problem: makeProblem() };
    const tx = makeTx();
    const { service, prisma } = makeService(async () => {
      throw new Error('runner boom');
    }, submission, tx);

    await expect(service.grade('s4')).rejects.toThrow('runner boom');
    expect(prisma.codingSubmission.update).toHaveBeenLastCalledWith({ where: { id: 's4' }, data: { status: 'error' } });
  });
});

describe('computeScore', () => {
  const tcs = [
    { id: 'a', weight: D(2) },
    { id: 'b', weight: D(3) },
  ];
  it('is 0 when nothing passes', () => {
    expect(computeScore(tcs, [], D(100)).toString()).toBe('0');
  });
  it('is weighted and rounded to 2dp', () => {
    const outcomes = [{ testCaseId: 'a', status: 'passed' as const, actualStdout: '', runtimeMs: null }];
    expect(computeScore(tcs, outcomes, D(100)).toString()).toBe('40'); // 2/5 * 100
  });
  it('returns 0 for no test cases (avoid divide by zero)', () => {
    expect(computeScore([], [], D(100)).toString()).toBe('0');
  });
});

describe('normalizeOutput', () => {
  it('ignores trailing newline and trailing spaces', () => {
    expect(normalizeOutput('1\n')).toBe(normalizeOutput('1'));
    expect(normalizeOutput('a  \nb\n\n')).toBe('a\nb');
  });
  it('normalizes CRLF', () => {
    expect(normalizeOutput('a\r\nb')).toBe('a\nb');
  });
});

describe('mapTestCaseStatus', () => {
  it('passes on matching ok output', () => {
    expect(mapTestCaseStatus(okOutput('42\n'), '42')).toBe('passed');
  });
  it('fails on mismatching ok output', () => {
    expect(mapTestCaseStatus(okOutput('41'), '42')).toBe('failed');
  });
  it('maps execution verdicts straight through', () => {
    const base = okOutput('');
    expect(mapTestCaseStatus({ ...base, verdict: 'tle' }, 'x')).toBe('tle');
    expect(mapTestCaseStatus({ ...base, verdict: 'mle' }, 'x')).toBe('mle');
    expect(mapTestCaseStatus({ ...base, verdict: 're' }, 'x')).toBe('re');
    expect(mapTestCaseStatus({ ...base, verdict: 'ce' }, 'x')).toBe('ce');
  });
});
