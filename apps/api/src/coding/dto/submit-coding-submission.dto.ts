import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CodingLanguageValue } from '@lms/contracts';

/**
 * Official submit payload. Client sends source only — score/result is always computed server-side
 * (never trust Pyodide/client results). classId scopes membership + gate checks.
 */
export class SubmitCodingSubmissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  classId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  sourceCode!: string;

  @IsOptional()
  @IsIn(['python'])
  language?: CodingLanguageValue;
}
