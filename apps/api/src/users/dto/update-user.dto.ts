import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateUserRequest, UserStatusValue } from '@lms/contracts';

export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsIn(['invited', 'active', 'suspended'])
  status?: UserStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;
}
