import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { SubmissionTypeValue, UpdateAssignmentRequest } from '@lms/contracts';

export class UpdateAssignmentDto implements UpdateAssignmentRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  descriptionMd?: string | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  maxScore?: number;

  @IsOptional()
  @IsBoolean()
  allowLate?: boolean;

  @IsOptional()
  @IsIn(['text', 'file', 'link'])
  submissionType?: SubmissionTypeValue;
}
