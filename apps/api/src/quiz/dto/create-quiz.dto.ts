import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { CreateQuizRequest } from '@lms/contracts';

export class CreateQuizDto implements CreateQuizRequest {
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
}
