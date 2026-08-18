import { useQuery } from '@tanstack/react-query';
import type { ClassReportDto } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export function useClassReport(classId?: string) {
  return useQuery({
    queryKey: ['class-report', classId],
    queryFn: () => apiFetch<ClassReportDto>(`/classes/${classId}/report`),
    enabled: Boolean(classId),
    staleTime: 60000,
  });
}
