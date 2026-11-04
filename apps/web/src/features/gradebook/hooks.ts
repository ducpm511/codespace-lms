import { useQuery } from '@tanstack/react-query';
import { getClassGradebook, recomputeClassGradebook, getStudentOwnGradebook } from './api';

// Staff của lớp mở sổ điểm → recompute (POST, GHI) để luôn thấy điểm mới nhất. GV lớp khác chỉ đọc
// nên dùng GET: thấy điểm tới lần tổng hợp gần nhất. `canRecompute` undefined = chưa biết, đợi.
export function useClassGradebook(classId: string | null, canRecompute: boolean | undefined) {
  return useQuery({
    queryKey: ['classGradebook', classId],
    queryFn: () => (canRecompute ? recomputeClassGradebook(classId!) : getClassGradebook(classId!)),
    enabled: Boolean(classId) && canRecompute !== undefined,
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
