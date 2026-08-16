import { useQuery } from '@tanstack/react-query';
import { getClassGradebook, getStudentOwnGradebook } from './api';

export function useClassGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['classGradebook', classId],
    queryFn: () => getClassGradebook(classId!),
    enabled: Boolean(classId),
  });
}

export function useStudentOwnGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['studentOwnGradebook', classId],
    queryFn: () => getStudentOwnGradebook(classId!),
    enabled: Boolean(classId),
  });
}
