import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MANUAL_NOTE_MAX_LENGTH, MANUAL_XP_MAX, MANUAL_XP_MIN } from '@lms/contracts';
import type { ManualAwardRequest } from '@lms/contracts';

/**
 * Allowlist cho lượt trao thưởng tay (T10.3). `studentId` KHÔNG nằm ở body — nó là param của route,
 * để không ai đổi được đích đến bằng cách nhét thêm trường vào body.
 */
export class ManualAwardDto implements ManualAwardRequest {
  @IsString()
  @MinLength(1)
  classId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  badgeCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_XP_MIN)
  @Max(MANUAL_XP_MAX)
  xpAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MANUAL_NOTE_MAX_LENGTH)
  note?: string;
}
