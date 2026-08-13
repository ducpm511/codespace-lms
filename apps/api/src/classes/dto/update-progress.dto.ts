import { IsIn } from 'class-validator';
import type { ProgressStatusValue, UpdateProgressRequest } from '@lms/contracts';

export class UpdateProgressDto implements UpdateProgressRequest {
  @IsIn(['not_started', 'in_progress', 'completed'])
  status!: ProgressStatusValue;
}
