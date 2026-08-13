import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateUserRequest, UserStatusValue } from '@lms/contracts';

export class CreateUserDto implements CreateUserRequest {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsIn(['invited', 'active', 'suspended'])
  status?: UserStatusValue;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleKeys?: string[];
}
