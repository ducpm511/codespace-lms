import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { LESSON_ACTIVITY_TYPES, type LessonActivityTypeValue } from '@lms/contracts';

export class CreateLessonActivityDto {
  @IsIn(LESSON_ACTIVITY_TYPES as readonly string[])
  type!: LessonActivityTypeValue;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  contentMd?: string;

  @IsOptional()
  @IsString()
  fileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  refId?: string;
}
