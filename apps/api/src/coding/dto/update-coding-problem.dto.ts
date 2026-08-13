import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CodingDifficultyValue, UpdateCodingProblemRequest } from '@lms/contracts';

export class UpdateCodingProblemDto implements UpdateCodingProblemRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  statementMd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  starterCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  solutionCode?: string | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60000)
  timeLimitMs?: number;

  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(1024)
  memoryLimitMb?: number;

  @IsOptional()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty?: CodingDifficultyValue;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  maxScore?: number;
}
