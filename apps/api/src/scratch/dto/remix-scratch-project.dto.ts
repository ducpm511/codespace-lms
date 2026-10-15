import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SCRATCH_TITLE_MAX_LENGTH } from '@lms/contracts';
import type { RemixScratchProjectRequest } from '@lms/contracts';

export class RemixScratchProjectDto implements RemixScratchProjectRequest {
  @IsOptional()
  @IsString()
  @MaxLength(SCRATCH_TITLE_MAX_LENGTH)
  title?: string;
}
