import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { ClassMemberRoleValue, EnrollMemberRequest } from '@lms/contracts';

export class EnrollMemberDto implements EnrollMemberRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  userId!: string;

  @IsOptional()
  @IsIn(['student', 'ta', 'instructor'])
  roleInClass?: ClassMemberRoleValue;
}
