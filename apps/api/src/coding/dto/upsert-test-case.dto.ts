import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { TestCaseKindValue, UpsertTestCaseRequest } from '@lms/contracts';

export class UpsertTestCaseDto implements UpsertTestCaseRequest {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  // stdin có thể rỗng (bài không cần input) → không MinLength.
  @IsString()
  @MaxLength(100000)
  stdin!: string;

  @IsString()
  @MaxLength(100000)
  expectedStdout!: string;

  @IsIn(['sample', 'hidden'])
  kind!: TestCaseKindValue;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  weight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}
