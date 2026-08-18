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
