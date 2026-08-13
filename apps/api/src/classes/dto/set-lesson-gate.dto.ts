import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import type { SetLessonGateRequest } from '@lms/contracts';

export class SetLessonGateDto implements SetLessonGateRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lessonId!: string;

  @IsBoolean()
  isActive!: boolean;
}
