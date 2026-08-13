import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { ClassStatusValue, UpdateClassRequest } from '@lms/contracts';

export class UpdateClassDto implements UpdateClassRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsIn(['planning', 'active', 'finished', 'archived'])
  status?: ClassStatusValue;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}
