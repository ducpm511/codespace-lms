import { useQuery } from '@tanstack/react-query';
import type { GamificationProfileDto } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export function useMyGamification() {
  return useQuery({
    queryKey: ['gamification', 'me'],
    queryFn: () => apiFetch<GamificationProfileDto>('/gamification/me'),
    staleTime: 60000,
  });
}
