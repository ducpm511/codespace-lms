import type {
  CodingProblemAuthorDetail,
  CodingProblemStudentDetail,
  CodingProblemSummary,
  CodingSubmissionDto,
  CreateCodingProblemRequest,
  Paginated,
  SubmitCodingRequest,
  UpdateCodingProblemRequest,
  UpsertTestCaseRequest,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

// --- Authoring (GV/admin) ---

export const listCodingProblems = (courseId?: string): Promise<Paginated<CodingProblemSummary>> => {
  const q = courseId ? `&courseId=${encodeURIComponent(courseId)}` : '';
  return apiFetch<Paginated<CodingProblemSummary>>(`/coding-problems?page=1&pageSize=100${q}`);
};

export const getCodingProblem = (id: string): Promise<CodingProblemAuthorDetail> =>
  apiFetch<CodingProblemAuthorDetail>(`/coding-problems/${encodeURIComponent(id)}`);

export const createCodingProblem = (
  body: CreateCodingProblemRequest,
): Promise<CodingProblemAuthorDetail> =>
  apiFetch<CodingProblemAuthorDetail>('/coding-problems', { method: 'POST', body: JSON.stringify(body) });

export const updateCodingProblem = (
  id: string,
  body: UpdateCodingProblemRequest,
): Promise<CodingProblemAuthorDetail> =>
  apiFetch<CodingProblemAuthorDetail>(`/coding-problems/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const deleteCodingProblem = (id: string): Promise<void> =>
  apiFetch<void>(`/coding-problems/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const upsertTestCase = (
  problemId: string,
  body: UpsertTestCaseRequest,
): Promise<CodingProblemAuthorDetail> =>
  apiFetch<CodingProblemAuthorDetail>(`/coding-problems/${encodeURIComponent(problemId)}/test-cases`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteTestCase = (
  problemId: string,
  testCaseId: string,
): Promise<CodingProblemAuthorDetail> =>
  apiFetch<CodingProblemAuthorDetail>(
    `/coding-problems/${encodeURIComponent(problemId)}/test-cases/${encodeURIComponent(testCaseId)}`,
    { method: 'DELETE' },
  );

// --- Student (làm bài) — chỉ sample test, submit + xem kết quả ---

export const listCodingProblemsForClass = (classId: string): Promise<CodingProblemSummary[]> =>
  apiFetch<CodingProblemSummary[]>(`/coding-problems/for-class/${encodeURIComponent(classId)}`);

export const getCodingAttempt = (
  id: string,
  classId: string,
): Promise<CodingProblemStudentDetail> =>
  apiFetch<CodingProblemStudentDetail>(
    `/coding-problems/${encodeURIComponent(id)}/attempt?classId=${encodeURIComponent(classId)}`,
  );

export const submitCoding = (
  problemId: string,
  body: SubmitCodingRequest,
): Promise<CodingSubmissionDto> =>
  apiFetch<CodingSubmissionDto>(`/coding-problems/${encodeURIComponent(problemId)}/submissions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getCodingSubmission = (id: string): Promise<CodingSubmissionDto> =>
  apiFetch<CodingSubmissionDto>(`/coding-submissions/${encodeURIComponent(id)}`);
