import { IsIn, IsOptional } from 'class-validator';
import type { LeaderboardWeek } from '@lms/contracts';

/** Chỉ cho xem tuần này / tuần trước — cố ý không có bảng tích luỹ vĩnh viễn (T10.1). */
export class LeaderboardQueryDto {
  @IsOptional()
  @IsIn(['current', 'previous'])
  week: LeaderboardWeek = 'current';
}
