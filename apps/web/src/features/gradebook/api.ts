import { apiFetch } from '../../lib/api';
import type { ClassGradebookDto, StudentOwnGradebookDto } from '@lms/contracts';

export function getClassGradebook(classId: string): Promise<ClassGradebookDto> {
  return apiFetch<ClassGradebookDto>(`/classes/${encodeURIComponent(classId)}/gradebook`);
}

export function getStudentOwnGradebook(classId: string): Promise<StudentOwnGradebookDto> {
  return apiFetch<StudentOwnGradebookDto>(`/classes/${encodeURIComponent(classId)}/my-gradebook`);
}
