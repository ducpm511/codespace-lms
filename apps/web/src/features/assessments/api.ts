import type {
  AssignmentDetail,
  AssignmentSummary,
  CreateAssignmentRequest,
  GradeSubmissionRequest,
  Paginated,
  SaveSubmissionRequest,
  SubmissionDto,
  UpdateAssignmentRequest,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export function listAssignments(courseId?: string): Promise<Paginated<AssignmentSummary>> {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  return apiFetch<Paginated<AssignmentSummary>>(`/assignments${query}`);
}

/** Student surface (P7): bài tập của lớp — chỉ bài đã mở gate; không cần quyền `assignment.read`. */
// AssignmentDetail (không phải Summary): học viên cần `descriptionMd` để đọc được đề bài.
export function listAssignmentsForClass(classId: string): Promise<AssignmentDetail[]> {
  return apiFetch<AssignmentDetail[]>(`/assignments/for-class/${classId}`);
}

export function getAssignment(id: string): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/assignments/${id}`);
}

export function createAssignment(body: CreateAssignmentRequest): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>('/assignments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAssignment(id: string, body: UpdateAssignmentRequest): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/assignments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAssignment(id: string): Promise<void> {
  return apiFetch<void>(`/assignments/${id}`, { method: 'DELETE' });
}

export function listSubmissions(
  classId: string,
  assignmentId: string,
  status?: string,
): Promise<Paginated<SubmissionDto>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Paginated<SubmissionDto>>(
    `/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}/submissions${query}`,
  );
}

export function gradeSubmission(
  submissionId: string,
  body: GradeSubmissionRequest,
): Promise<SubmissionDto> {
  return apiFetch<SubmissionDto>(`/submissions/${encodeURIComponent(submissionId)}/grade`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getMySubmission(
  assignmentId: string,
  classId: string,
): Promise<SubmissionDto | null> {
  return apiFetch<SubmissionDto | null>(
    `/assignments/${encodeURIComponent(assignmentId)}/submissions/mine?classId=${encodeURIComponent(classId)}`,
  );
}

export function saveSubmission(
  assignmentId: string,
  body: SaveSubmissionRequest,
): Promise<SubmissionDto> {
  return apiFetch<SubmissionDto>(`/assignments/${encodeURIComponent(assignmentId)}/submissions/save`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function submitSubmission(
  assignmentId: string,
  body: { classId: string },
): Promise<SubmissionDto> {
  return apiFetch<SubmissionDto>(`/assignments/${encodeURIComponent(assignmentId)}/submissions/submit`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
