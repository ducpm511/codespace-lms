import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  QuizQuestionTypeValue,
  UpsertQuestionOptionRequest,
  UpsertQuestionRequest,
} from '@lms/contracts';

const QUESTION_TYPES: QuizQuestionTypeValue[] = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_answer',
  'code_fill',
];

export class UpsertQuestionOptionDto implements UpsertQuestionOptionRequest {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  textMd!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}

export class UpsertQuestionDto implements UpsertQuestionRequest {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsIn(QUESTION_TYPES)
  type!: QuizQuestionTypeValue;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  promptMd!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  correctAnswer?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpsertQuestionOptionDto)
  options?: UpsertQuestionOptionDto[];
}
