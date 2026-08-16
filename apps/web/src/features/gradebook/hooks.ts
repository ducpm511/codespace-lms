import { useQuery } from '@tanstack/react-query';
import { recomputeClassGradebook, getStudentOwnGradebook } from './api';

// Staff mở sổ điểm lớp → recompute (POST, GHI) để luôn thấy điểm mới nhất. Read GET thuần
// (getClassGradebook) vẫn có sẵn cho nơi chỉ cần đọc mà không muốn tổng hợp lại.
export function useClassGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['classGradebook', classId],
    queryFn: () => recomputeClassGradebook(classId!),
    enabled: Boolean(classId),
    refetchOnWindowFocus: false,
  });
}

export function useStudentOwnGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['studentOwnGradebook', classId],
    queryFn: () => getStudentOwnGradebook(classId!),
    enabled: Boolean(classId),
  });
}
