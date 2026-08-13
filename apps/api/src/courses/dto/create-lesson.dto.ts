import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CreateLessonRequest, LessonTypeValue } from '@lms/contracts';

const LESSON_TYPES = ['video', 'article', 'interactive', 'coding', 'quiz', 'assignment'] as const;

export class CreateLessonDto implements CreateLessonRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

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
  contentMd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedMinutes?: number;
}
