// Hợp đồng Gamification dùng chung FE <-> BE. Nguồn: docs/adr/002-gamification-system.md.

export interface BadgeDto {
  id: string;
  code: string;
  name: string;
  description: string;
  icon?: string | null;
  awardedAt?: string | null;
  /** Lời nhắn của giáo viên khi trao tay (T10.3). Huy hiệu tự động luôn null. */
  note?: string | null;
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
  /**
   * XP do giáo viên thưởng tay (T10.3). Tách riêng vì nó KHÔNG thuộc ba ô đếm nỗ lực — gộp chung
   * thì dòng "0 bài học · 0 trắc nghiệm · 0 lập trình" đứng cạnh "50 XP" và trông như lỗi.
   */
  bonusXp: number;
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

// --- T10.3 — Giáo viên trao thưởng thủ công ---

/**
 * Trần XP cho một lượt thưởng tay. Có trần vì XP thưởng tay được tính vào bảng xếp hạng tuần:
 * không chặn thì một lượt thưởng có thể lật ngược cả bảng và biến nó thành trò vô nghĩa.
 */
export const MANUAL_XP_MIN = 5;
export const MANUAL_XP_MAX = 200;
/** Lời nhắn hiển thị nguyên văn cho học viên — giữ ngắn để còn đọc được trong thông báo. */
export const MANUAL_NOTE_MAX_LENGTH = 300;

/** Một lượt trao: huy hiệu, hoặc XP, hoặc cả hai — nhưng phải có ít nhất một. */
export interface ManualAwardRequest {
  /** Lớp diễn ra việc trao. Bắt buộc: quyền được chấm theo LỚP, không trao xuyên lớp. */
  classId: string;
  /** `Badge.code` của huy hiệu trao tay (`isManual = true`). */
  badgeCode?: string;
  xpAmount?: number;
  note?: string;
}

export interface ManualAwardResultDto {
  studentId: string;
  classId: string;
  /** null khi lượt này chỉ thưởng XP. */
  badge: BadgeDto | null;
  xpAwarded: number;
  note: string | null;
  awardedAt: string;
}
