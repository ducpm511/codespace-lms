import { IsString, MinLength } from 'class-validator';
import type { RevokeCertificateRequest } from '@lms/contracts';

export class RevokeCertificateDto implements RevokeCertificateRequest {
  @IsString()
  @MinLength(1)
  reason!: string;
}
