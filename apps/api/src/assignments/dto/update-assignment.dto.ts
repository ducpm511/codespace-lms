import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { SCRATCH_CHECK_KEYS, SUBMISSION_TYPES } from '@lms/contracts';
import type { SubmissionTypeValue, UpdateAssignmentRequest } from '@lms/contracts';
import { ScratchCheckDto } from './scratch-check.dto';

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
  @IsIn(SUBMISSION_TYPES as readonly string[])
  submissionType?: SubmissionTypeValue;

  /** Chỉ có nghĩa khi submissionType = scratch (bài khác: server lưu null). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SCRATCH_CHECK_KEYS.length)
  @ValidateNested({ each: true })
  @Type(() => ScratchCheckDto)
  scratchChecks?: ScratchCheckDto[] | null;
}
