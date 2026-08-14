import { Injectable, Logger } from '@nestjs/common';
import { AutograderService } from '../grading/autograder.service';
import { SubmissionQueue } from './submission-queue';

/**
 * In-process queue driver: grades synchronously in the caller's context. No Redis required.
 * Default for local dev / tests. The submission is created with status=queued by the service, then
 * this grades it to a terminal status before enqueue() resolves.
 */
@Injectable()
export class InlineSubmissionQueue extends SubmissionQueue {
  private readonly logger = new Logger(InlineSubmissionQueue.name);

  constructor(private readonly autograder: AutograderService) {
    super();
  }

  async enqueue(submissionId: string): Promise<void> {
    try {
      await this.autograder.grade(submissionId);
    } catch (err) {
      // grade() already set status=error; swallow so the submit request still succeeds.
      this.logger.error(`inline grade ${submissionId} failed: ${(err as Error).message}`);
    }
  }
}
