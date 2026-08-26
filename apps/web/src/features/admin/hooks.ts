import { useQuery } from '@tanstack/react-query';
import type { AdminOverviewDto } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const adminOverviewKey = ['admin', 'overview'] as const;

/** Dãy số liệu đầu khu Quản trị (T10.5). Một request, đếm ở server. */
export function useAdminOverview() {
  return useQuery({
    queryKey: adminOverviewKey,
    queryFn: () => apiFetch<AdminOverviewDto>('/admin/overview'),
    staleTime: 5 * 60 * 1000,
  });
}
