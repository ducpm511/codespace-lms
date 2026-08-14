import type { RunnerOutput } from '../runner/runner.types';

export type TestCaseResultStatus = 'passed' | 'failed' | 'tle' | 'mle' | 're' | 'ce';
export type CodingSubmissionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error';

/**
 * Normalize program output for comparison: strip trailing whitespace per line and drop trailing
 * blank lines. Lenient enough to ignore a missing/extra final newline, strict on content.
 */
export function normalizeOutput(s: string): string {
  const lines = s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.join('\n');
}

/**
 * Map a runner output + expected stdout to a test-case verdict.
 * Only an 'ok' execution is compared against expected; every other verdict is a hard status.
 */
export function mapTestCaseStatus(output: RunnerOutput, expectedStdout: string): TestCaseResultStatus {
  switch (output.verdict) {
    case 'ok':
      return normalizeOutput(output.stdout) === normalizeOutput(expectedStdout) ? 'passed' : 'failed';
    case 'tle':
      return 'tle';
    case 'mle':
      return 'mle';
    case 're':
      return 're';
    case 'ce':
      return 'ce';
    default:
      return 're';
  }
}
