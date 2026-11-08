import { useQuery } from '@tanstack/react-query';
import { getClassGradebook, recomputeClassGradebook, getStudentOwnGradebook } from './api';

// Staff của lớp mở sổ điểm → recompute (POST, GHI: lưu sổ cho chứng chỉ). GV lớp khác chỉ đọc nên dùng
// GET; cả hai đều tính từ bài nộp nên điểm như nhau. `canRecompute` undefined = chưa biết, đợi.
export function useClassGradebook(classId: string | null, canRecompute: boolean | undefined) {
  return useQuery({
    queryKey: ['classGradebook', classId],
    queryFn: () => (canRecompute ? recomputeClassGradebook(classId!) : getClassGradebook(classId!)),
    enabled: Boolean(classId) && canRecompute !== undefined,
    refetchOnWindowFocus: false,
    // Mở lại tab là đọc lại: học viên nộp bài hay GV chấm ở tab khác đều đổi điểm.
    staleTime: 0,
  });
}

export function useStudentOwnGradebook(classId: string | null) {
  return useQuery({
    queryKey: ['studentOwnGradebook', classId],
    queryFn: () => getStudentOwnGradebook(classId!),
    enabled: Boolean(classId),
  });
}
