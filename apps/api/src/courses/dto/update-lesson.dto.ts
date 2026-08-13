import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { LessonTypeValue, UpdateLessonRequest } from '@lms/contracts';

const LESSON_TYPES = ['video', 'article', 'interactive', 'coding', 'quiz', 'assignment'] as const;

export class UpdateLessonDto implements UpdateLessonRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;

  @IsOptional()
  @IsIn(LESSON_TYPES)
  type?: LessonTypeValue;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  contentMd?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedMinutes?: number | null;
}
