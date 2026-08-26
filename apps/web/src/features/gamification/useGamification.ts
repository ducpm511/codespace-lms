import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BadgeDto,
  ClassLeaderboardDto,
  GamificationProfileDto,
  LeaderboardWeek,
  ManualAwardRequest,
  ManualAwardResultDto,
} from '@lms/contracts';
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

// --- T10.3 — giáo viên trao thưởng thủ công ---

export const manualBadgesKey = ['gamification', 'manual-badges'] as const;

export function useManualBadges() {
  return useQuery({
    queryKey: manualBadgesKey,
    queryFn: () => apiFetch<BadgeDto[]>('/gamification/manual-badges'),
    // Danh sách huy hiệu trao tay chỉ đổi khi chạy seed — không cần nạp lại liên tục.
    staleTime: 30 * 60 * 1000,
  });
}

export function useAwardManually(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { studentId: string; body: ManualAwardRequest }) =>
      apiFetch<ManualAwardResultDto>(`/gamification/students/${vars.studentId}/awards`, {
        method: 'POST',
        body: JSON.stringify(vars.body),
      }),
    // XP thưởng tay được tính vào bảng xếp hạng tuần → phải nạp lại ngay để GV thấy kết quả.
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['classes', classId, 'leaderboard'] }),
  });
}
