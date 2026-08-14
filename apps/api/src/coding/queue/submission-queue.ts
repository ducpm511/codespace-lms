export const CODING_QUEUE_NAME = 'coding-autograde';
export const CODING_GRADE_JOB = 'grade-submission';

export interface GradeJobData {
  submissionId: string;
}

/**
 * Port for enqueuing autograding work. Submission/business code depends only on this; the concrete
 * driver (inline or BullMQ) is selected in CodingQueueModule. Keeps the API decoupled from Redis.
 */
export abstract class SubmissionQueue {
  abstract enqueue(submissionId: string): Promise<void>;
}
