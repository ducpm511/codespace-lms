import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { AssignCourseRequest } from '@lms/contracts';

export class AssignCourseDto implements AssignCourseRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  courseId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}
