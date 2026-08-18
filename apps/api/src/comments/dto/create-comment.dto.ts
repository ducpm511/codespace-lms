import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateLessonCommentRequest } from '@lms/contracts';

export class CreateCommentDto implements CreateLessonCommentRequest {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
