import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SCRATCH_CHECK_KEYS, SCRATCH_CHECK_MIN_MAX } from '@lms/contracts';
import type { ScratchCheck, ScratchCheckKey } from '@lms/contracts';

/** Một tiêu chí gợi ý khi chấm bài BlockSpace (allowlist khóa — không nhận gì khác). */
export class ScratchCheckDto implements ScratchCheck {
  @IsIn(SCRATCH_CHECK_KEYS as readonly string[])
  key!: ScratchCheckKey;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(SCRATCH_CHECK_MIN_MAX)
  min?: number;
}
