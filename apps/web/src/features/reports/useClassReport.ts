import { useQueries, useQuery } from '@tanstack/react-query';
import type { ClassReportDto } from '@lms/contracts';
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

/** Nhiều lớp cùng lúc (hero Giảng dạy). Dùng chung cache key với `useClassReport`. */
export function useClassReports(classIds: string[]) {
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: classReportKey(classId),
      queryFn: () => apiFetch<ClassReportDto>(`/classes/${classId}/report`),
      staleTime: 60000,
    })),
  });
}
