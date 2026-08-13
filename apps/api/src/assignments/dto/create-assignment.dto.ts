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
import type { CreateAssignmentRequest, SubmissionTypeValue } from '@lms/contracts';

export class CreateAssignmentDto implements CreateAssignmentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  courseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lessonId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  descriptionMd?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

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
