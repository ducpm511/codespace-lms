import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { CreateRoleRequest } from '@lms/contracts';

export class CreateRoleDto implements CreateRoleRequest {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'key: dùng snake_case (a-z, 0-9, _)' })
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
