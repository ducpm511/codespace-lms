import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RunnerService,
  capStdout,
  type RunnerInput,
  type RunnerOutput,
  type RunnerVerdict,
} from './runner.types';

/** Shape of Piston `/api/v2/execute` response we rely on. */
interface PistonStage {
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number | null;
  signal?: string | null;
}
interface PistonExecuteResponse {
  compile?: PistonStage;
  run?: PistonStage;
}

const LANGUAGE_MAP: Record<string, string> = { python: 'python' };

/**
 * Piston self-hosted adapter (ADR 001). Endpoint + token come from env; nothing hardcoded.
 *   CODE_RUNNER_URL           base URL, e.g. http://localhost:2000
 *   CODE_RUNNER_TOKEN         optional bearer token for the runner
 *   CODE_RUNNER_PYTHON_VERSION default '*' (let Piston pick installed version)
 *
 * The runner container is what enforces isolation (no network, cgroup CPU/RAM). This adapter only
 * translates our neutral RunnerInput/Output and applies a defensive stdout cap.
 */
@Injectable()
export class PistonRunnerAdapter extends RunnerService {
  private readonly logger = new Logger(PistonRunnerAdapter.name);
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly pythonVersion: string;

  constructor(config: ConfigService) {
    super();
    const url = config.get<string>('CODE_RUNNER_URL');
    if (!url) {
      throw new Error('CODE_RUNNER_URL is required when CODE_RUNNER_PROVIDER=piston');
    }
    this.baseUrl = url.replace(/\/+$/, '');
    this.token = config.get<string>('CODE_RUNNER_TOKEN') || undefined;
    this.pythonVersion = config.get<string>('CODE_RUNNER_PYTHON_VERSION') || '*';
  }

  async run(input: RunnerInput): Promise<RunnerOutput> {
    const language = LANGUAGE_MAP[input.language];
    if (!language) {
      throw new Error(`Unsupported runner language: ${input.language}`);
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    // Give the HTTP call a little slack over the run budget so we read the runner's own verdict
    // (SIGKILL) rather than aborting the request first.
    const abort = new AbortController();
    const httpTimeout = input.timeLimitMs + 5000;
    const timer = setTimeout(() => abort.abort(), httpTimeout);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v2/execute`, {
        method: 'POST',
        headers,
        signal: abort.signal,
        body: JSON.stringify({
          language,
          version: this.pythonVersion,
          files: [{ content: input.sourceCode }],
          stdin: input.stdin,
          run_timeout: input.timeLimitMs,
          compile_timeout: input.timeLimitMs,
          run_memory_limit: input.memoryLimitMb * 1024 * 1024,
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      // Network/abort failure is an infra problem, surfaced as a runtime error verdict for the grader.
      this.logger.error(`Piston request failed: ${(err as Error).message}`);
      return errorOutput('re', `runner_unreachable: ${(err as Error).message}`);
    }
    clearTimeout(timer);

    if (!res.ok) {
      const body = await safeText(res);
      this.logger.error(`Piston HTTP ${res.status}: ${body.slice(0, 500)}`);
      return errorOutput('re', `runner_http_${res.status}`);
    }

    const data = (await res.json()) as PistonExecuteResponse;
    return this.mapResponse(data, input.stdoutLimitBytes);
  }

  private mapResponse(data: PistonExecuteResponse, stdoutLimitBytes: number): RunnerOutput {
    const compile = data.compile;
    const run = data.run;

    // A compile stage that failed maps to CE (kept for parity; Python normally has none).
    if (compile && compile.code != null && compile.code !== 0) {
      const { text, truncated } = capStdout(compile.stdout ?? '', stdoutLimitBytes);
      return {
        verdict: 'ce',
        stdout: text,
        stderr: compile.stderr ?? '',
        exitCode: compile.code ?? null,
        runtimeMs: null,
        memoryKb: null,
        truncated,
      };
    }

    const { text, truncated } = capStdout(run?.stdout ?? '', stdoutLimitBytes);
    return {
      verdict: verdictFromRun(run),
      stdout: text,
      stderr: run?.stderr ?? '',
      exitCode: run?.code ?? null,
      runtimeMs: null, // Piston does not report wall time; left to the queue timer if needed
      memoryKb: null,
      truncated,
    };
  }
}

/** Map a Piston run stage to an execution verdict. SIGKILL is treated as TLE (the common cause). */
function verdictFromRun(run?: PistonStage): RunnerVerdict {
  if (!run) {
    return 're';
  }
  if (run.signal === 'SIGKILL' || run.signal === 'SIGXCPU') {
    return 'tle';
  }
  if (run.code != null && run.code !== 0) {
    return 're';
  }
  if (run.signal) {
    return 're';
  }
  return 'ok';
}

function errorOutput(verdict: RunnerVerdict, stderr: string): RunnerOutput {
  return {
    verdict,
    stdout: '',
    stderr,
    exitCode: null,
    runtimeMs: null,
    memoryKb: null,
    truncated: false,
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
