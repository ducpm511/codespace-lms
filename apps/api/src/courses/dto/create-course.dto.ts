import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { CourseLanguageValue, CourseLevelValue, CreateCourseRequest } from '@lms/contracts';

export class CreateCourseDto implements CreateCourseRequest {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug phải là kebab-case (a-z, 0-9, dấu -)' })
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['scratch', 'python', 'other'])
  language?: CourseLanguageValue;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level?: CourseLevelValue;
}
