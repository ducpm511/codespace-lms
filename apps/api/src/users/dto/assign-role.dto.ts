import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AssignRoleRequest } from '@lms/contracts';

export class AssignRoleDto implements AssignRoleRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  roleKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  classId?: string | null;
}
