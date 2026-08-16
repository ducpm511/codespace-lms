import { apiFetch } from '../../lib/api';
import type { ClassGradebookDto, StudentOwnGradebookDto } from '@lms/contracts';

export function getClassGradebook(classId: string): Promise<ClassGradebookDto> {
  return apiFetch<ClassGradebookDto>(`/classes/${encodeURIComponent(classId)}/gradebook`);
}

/** Staff mở sổ điểm → tổng hợp lại (POST, GHI DB) rồi trả kết quả mới. Tách write khỏi GET. */
export function recomputeClassGradebook(classId: string): Promise<ClassGradebookDto> {
  return apiFetch<ClassGradebookDto>(`/classes/${encodeURIComponent(classId)}/gradebook/recompute`, {
    method: 'POST',
  });
}

export function getStudentOwnGradebook(classId: string): Promise<StudentOwnGradebookDto> {
  return apiFetch<StudentOwnGradebookDto>(`/classes/${encodeURIComponent(classId)}/my-gradebook`);
}
