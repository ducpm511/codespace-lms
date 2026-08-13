import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  CodingDifficultyValue,
  CodingLanguageValue,
  CreateCodingProblemRequest,
} from '@lms/contracts';

export class CreateCodingProblemDto implements CreateCodingProblemRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  courseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lessonId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  statementMd!: string;

  @IsOptional()
  @IsIn(['python'])
  language?: CodingLanguageValue;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  starterCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  solutionCode?: string;

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
