import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CourseLanguageValue, CourseLevelValue, UpdateCourseRequest } from '@lms/contracts';

export class UpdateCourseDto implements UpdateCourseRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl?: string | null;

  @IsOptional()
  @IsIn(['scratch', 'python', 'other'])
  language?: CourseLanguageValue;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level?: CourseLevelValue;
}
