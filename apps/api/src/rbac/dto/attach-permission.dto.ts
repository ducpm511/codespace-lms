import { IsString, MaxLength, MinLength } from 'class-validator';
import type { AttachPermissionRequest } from '@lms/contracts';

export class AttachPermissionDto implements AttachPermissionRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  permissionKey!: string;
}
