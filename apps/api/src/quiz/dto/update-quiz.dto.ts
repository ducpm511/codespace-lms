import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { UpdateQuizRequest } from '@lms/contracts';

export class UpdateQuizDto implements UpdateQuizRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  timeLimitSec?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  attemptsAllowed?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  passScore?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
