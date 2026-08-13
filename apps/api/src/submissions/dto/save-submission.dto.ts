import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { SaveSubmissionRequest } from '@lms/contracts';

export class SaveSubmissionDto implements SaveSubmissionRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  classId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  contentText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  fileId?: string;
}
