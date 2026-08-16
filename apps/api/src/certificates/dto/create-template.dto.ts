import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import type { CreateCertificateTemplateRequest } from '@lms/contracts';

export class CreateCertificateTemplateDto implements CreateCertificateTemplateRequest {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  backgroundFileId?: string;

  @IsOptional()
  @IsObject()
  layoutJson?: Record<string, unknown>;
}
