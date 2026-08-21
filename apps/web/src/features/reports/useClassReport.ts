import { useQuery } from '@tanstack/react-query';
import type { ClassReportDto, TeachOverviewDto } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const classReportKey = (classId?: string) => ['class-report', classId] as const;

export function useClassReport(classId?: string) {
  return useQuery({
    queryKey: classReportKey(classId),
    queryFn: () => apiFetch<ClassReportDto>(`/classes/${classId}/report`),
    enabled: Boolean(classId),
    staleTime: 60000,
  });
}

export const teachOverviewKey = ['teach', 'overview'] as const;

/**
 * Số liệu hero khu Giảng dạy trong MỘT request. Trước đây hero gọi
 * `/classes/:id/report` cho từng lớp — 10 lớp là 10 truy vấn tổng hợp mỗi lần mở tab.
 */
export function useTeachOverview() {
  return useQuery({
    queryKey: teachOverviewKey,
    queryFn: () => apiFetch<TeachOverviewDto>('/teach/overview'),
    staleTime: 60000,
  });
}
