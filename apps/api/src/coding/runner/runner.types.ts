// Neutral runner contract. Business/grading code depends ONLY on these types, never on a concrete
// runner (Piston/Judge0). See docs/adr/001-code-runner-piston-mvp.md (D2).

/** Execution-level outcome of a single run, BEFORE comparing stdout to the expected output. */
export type RunnerVerdict =
  | 'ok' // process exited 0 within limits; caller compares stdout vs expected
  | 'tle' // time limit / wall-time exceeded (killed)
  | 'mle' // memory limit exceeded
  | 're' // runtime error (non-zero exit, uncaught exception)
  | 'ce'; // compile error (not typical for Python, kept for adapter parity)

export interface RunnerInput {
  language: string; // 'python'
  sourceCode: string;
  stdin: string;
  timeLimitMs: number; // per-run CPU/wall time budget
  memoryLimitMb: number;
  stdoutLimitBytes: number; // hard cap; runner/adapter truncates beyond this
}

export interface RunnerOutput {
  verdict: RunnerVerdict;
  stdout: string; // possibly truncated to stdoutLimitBytes
  stderr: string;
  exitCode: number | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  truncated: boolean; // true when stdout was capped
}

/** Injection token / base class for the active runner adapter. */
export abstract class RunnerService {
  abstract run(input: RunnerInput): Promise<RunnerOutput>;
}

/** Cap a stdout string to a byte budget (UTF-8), returning the truncation flag. */
export function capStdout(stdout: string, limitBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(stdout, 'utf8');
  if (buf.byteLength <= limitBytes) {
    return { text: stdout, truncated: false };
  }
  // Slice on a byte boundary; drop a possibly-split trailing multibyte char.
  const sliced = buf.subarray(0, limitBytes).toString('utf8').replace(/�$/, '');
  return { text: sliced, truncated: true };
}
