import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CreateSectionRequest } from '@lms/contracts';

export class CreateSectionDto implements CreateSectionRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}
