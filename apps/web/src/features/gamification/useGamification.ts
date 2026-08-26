import { useQuery } from '@tanstack/react-query';
import type { ClassLeaderboardDto, GamificationProfileDto, LeaderboardWeek } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const gamificationMeKey = ['gamification', 'me'] as const;

export function useMyGamification() {
  return useQuery({
    queryKey: gamificationMeKey,
    queryFn: () => apiFetch<GamificationProfileDto>('/gamification/me'),
    staleTime: 60000,
  });
}

// --- T10.1 — bảng xếp hạng theo lớp, theo tuần ---

export const classLeaderboardKey = (classId: string, week: LeaderboardWeek) =>
  ['classes', classId, 'leaderboard', week] as const;

export function useClassLeaderboard(classId: string | null, week: LeaderboardWeek) {
  return useQuery({
    queryKey: classLeaderboardKey(classId ?? '', week),
    queryFn: () =>
      apiFetch<ClassLeaderboardDto>(`/classes/${classId}/leaderboard?week=${week}`),
    enabled: Boolean(classId),
    staleTime: 60000,
  });
}
