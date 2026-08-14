import { type DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RunnerModule } from '../runner/runner.module';
import { AutograderService } from '../grading/autograder.service';
import { SubmissionQueue } from './submission-queue';
import { InlineSubmissionQueue } from './inline-submission-queue';
import { BullSubmissionQueue } from './bull-submission-queue';

/**
 * Wires the autograde pipeline. Driver is chosen by env CODE_QUEUE_DRIVER at registration time so
 * that only the selected class is instantiated (inline mode never opens a Redis connection):
 *   'bull'   -> BullSubmissionQueue (async via Redis; requires REDIS_URL)
 *   'inline' -> InlineSubmissionQueue (synchronous, no Redis) [default]
 */
@Module({})
export class CodingQueueModule {
  static register(): DynamicModule {
    const driver = (process.env.CODE_QUEUE_DRIVER ?? 'inline').toLowerCase();
    const useClass = driver === 'bull' ? BullSubmissionQueue : InlineSubmissionQueue;
    Logger.log(`Autograde queue driver: ${driver === 'bull' ? 'bull' : 'inline'}`, 'CodingQueueModule');

    return {
      module: CodingQueueModule,
      imports: [ConfigModule, RunnerModule],
      providers: [AutograderService, { provide: SubmissionQueue, useClass }],
      exports: [SubmissionQueue, AutograderService],
    };
  }
}
