import { Injectable, Logger } from '@nestjs/common';
import { RunnerService, capStdout, type RunnerInput, type RunnerOutput } from './runner.types';

/**
 * Non-executing runner for local dev / smoke when no isolated runner is provisioned.
 *
 * INVARIANT: it does NOT run student code (that must always go through an isolated runner —
 * cx-hard-limits §DOMAIN). It only echoes stdin back as stdout so the queue/grading pipeline can be
 * exercised end-to-end without Piston. Never select this provider in production.
 */
@Injectable()
export class StubRunnerAdapter extends RunnerService {
  private readonly logger = new Logger(StubRunnerAdapter.name);

  async run(input: RunnerInput): Promise<RunnerOutput> {
    this.logger.warn('StubRunnerAdapter active — code is NOT executed (dev/smoke only).');
    const { text, truncated } = capStdout(input.stdin, input.stdoutLimitBytes);
    return {
      verdict: 'ok',
      stdout: text,
      stderr: '',
      exitCode: 0,
      runtimeMs: 0,
      memoryKb: 0,
      truncated,
    };
  }
}
