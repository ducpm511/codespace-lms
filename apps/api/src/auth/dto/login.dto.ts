import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest } from '@lms/contracts';

// DTO = hợp đồng (LoginRequest) + decorator validate (sk-dto-validation). Allowlist qua ValidationPipe.
export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
