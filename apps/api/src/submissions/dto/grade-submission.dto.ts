import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { GradeSubmissionRequest } from '@lms/contracts';

export class GradeSubmissionDto implements GradeSubmissionRequest {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  feedbackMd?: string;
}
