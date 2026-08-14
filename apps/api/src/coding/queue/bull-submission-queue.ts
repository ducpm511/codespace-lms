import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { AutograderService } from '../grading/autograder.service';
import {
  CODING_GRADE_JOB,
  CODING_QUEUE_NAME,
  SubmissionQueue,
  type GradeJobData,
} from './submission-queue';

/**
 * BullMQ-backed driver: submit enqueues a job on Redis; a Worker (started here) grades it out of
 * band. Selected when CODE_QUEUE_DRIVER=bull. Requires REDIS_URL (docker dev: redis://localhost:6380).
 *
 * The Worker runs in-process for the MVP; it can be split into a dedicated process later without
 * changing the SubmissionQueue port or the autograder.
 */
@Injectable()
export class BullSubmissionQueue extends SubmissionQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullSubmissionQueue.name);
  private readonly connection: ConnectionOptions;
  private queue?: Queue<GradeJobData>;
  private worker?: Worker<GradeJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly autograder: AutograderService,
  ) {
    super();
    this.connection = parseRedisUrl(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6380');
  }

  onModuleInit(): void {
    this.queue = new Queue<GradeJobData>(CODING_QUEUE_NAME, { connection: this.connection });
    this.worker = new Worker<GradeJobData>(
      CODING_QUEUE_NAME,
      async (job: Job<GradeJobData>) => {
        await this.autograder.grade(job.data.submissionId);
      },
      { connection: this.connection, concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`grade job ${job?.id} failed: ${err.message}`);
    });
    this.logger.log('BullMQ autograde worker started');
  }

  async enqueue(submissionId: string): Promise<void> {
    if (!this.queue) {
      throw new Error('BullSubmissionQueue not initialized');
    }
    await this.queue.add(
      CODING_GRADE_JOB,
      { submissionId },
      { attempts: 2, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

/** Parse redis://[:password@]host:port[/db] into BullMQ connection options. */
function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
  };
}
