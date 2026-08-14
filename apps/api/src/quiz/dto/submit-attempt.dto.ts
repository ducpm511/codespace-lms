import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { SubmitQuizAnswerInput, SubmitQuizAttemptRequest } from '@lms/contracts';

export class SubmitQuizAnswerDto implements SubmitQuizAnswerInput {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  questionId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  textAnswer?: string;
}

/** Client gửi câu trả lời; điểm LUÔN chấm lại server-side. classId scope membership + attemptsAllowed. */
export class SubmitAttemptDto implements SubmitQuizAttemptRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  classId!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  answers!: SubmitQuizAnswerDto[];
}
