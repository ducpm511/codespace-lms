import { IsOptional, IsString, MinLength } from 'class-validator';
import type { IssueCertificateRequest } from '@lms/contracts';

export class IssueCertificateDto implements IssueCertificateRequest {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  courseId!: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsString()
  @MinLength(1)
  templateId!: string;
}
