// Hợp đồng Gamification dùng chung FE <-> BE. Nguồn: docs/adr/002-gamification-system.md.

export interface BadgeDto {
  id: string;
  code: string;
  name: string;
  description: string;
  icon?: string | null;
  awardedAt?: string | null;
}

export interface GamificationStreakDto {
  current: number;
  longest: number;
  lastActiveDate?: string | null;
}

export interface GamificationXpDto {
  total: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  ringTurn: number;
}

export interface GamificationProfileDto {
  streak: GamificationStreakDto;
  xp: GamificationXpDto;
  badges: BadgeDto[];
  allBadges?: BadgeDto[];
}

// --- T10.1 — Bảng xếp hạng theo LỚP, theo TUẦN (reset thứ Hai, giờ VN) ---

/** Cửa sổ tuần muốn xem. Chỉ 2 giá trị: tuần này / tuần trước — không có bảng tích luỹ vĩnh viễn. */
export type LeaderboardWeek = 'current' | 'previous';

/**
 * Một dòng xếp hạng. Chỉ số là NỖ LỰC (XP tuần = số việc hoàn thành × mức cố định),
 * KHÔNG phải điểm số hay tốc độ — xem docs/adr/002-gamification-system.md.
 */
export interface LeaderboardEntryDto {
  /** Hạng đồng điểm dùng chung số (1, 1, 3 — competition ranking). */
  rank: number;
  userId: string;
  fullName: string;
  xp: number;
  lessonsCompleted: number;
  quizzesPassed: number;
  codingPassed: number;
  isMe: boolean;
}

export interface ClassLeaderboardDto {
  classId: string;
  week: LeaderboardWeek;
  /** Mốc thứ Hai 00:00 giờ VN của tuần, dạng ISO (UTC). */
  weekStart: string;
  /** Mốc thứ Hai kế tiếp, ISO (UTC) — nửa khoảng [weekStart, weekEnd). */
  weekEnd: string;
  /** Chỉ học viên (roleInClass = student) đang hoạt động. GV/TA không xếp hạng. */
  entries: LeaderboardEntryDto[];
  /** Dòng của chính người xem; null khi người xem là GV/TA hoặc không phải học viên lớp. */
  me: LeaderboardEntryDto | null;
}
