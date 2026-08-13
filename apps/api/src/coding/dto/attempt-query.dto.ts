import { IsString, MaxLength, MinLength } from 'class-validator';

/** Học viên xem đề để làm bài trong một lớp cụ thể (kiểm membership + gate). */
export class AttemptQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  classId!: string;
}
