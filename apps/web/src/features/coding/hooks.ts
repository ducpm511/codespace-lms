import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CodingSubmissionDto,
  CreateCodingProblemRequest,
  SubmitCodingRequest,
  UpdateCodingProblemRequest,
  UpsertTestCaseRequest,
} from '@lms/contracts';
import * as api from './api';

const TERMINAL_STATUSES = new Set(['passed', 'failed', 'error']);
const isTerminal = (status?: string): boolean => !!status && TERMINAL_STATUSES.has(status);

export const codingProblemsKey = (courseId?: string) =>
  ['codingProblems', courseId ?? '_all'] as const;
export const codingProblemKey = (id: string) => ['codingProblem', id] as const;

export function useCodingProblems(courseId?: string) {
  return useQuery({
    queryKey: codingProblemsKey(courseId),
    queryFn: () => api.listCodingProblems(courseId),
  });
}

export function useCodingProblem(id: string | null) {
  return useQuery({
    queryKey: codingProblemKey(id ?? '_none'),
    queryFn: () => api.getCodingProblem(id as string),
    enabled: !!id,
  });
}

export function useCreateCodingProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCodingProblemRequest) => api.createCodingProblem(body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: codingProblemsKey(res.courseId) });
      void qc.invalidateQueries({ queryKey: ['codingProblems'] });
    },
  });
}

export function useUpdateCodingProblem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCodingProblemRequest) => api.updateCodingProblem(id, body),
    onSuccess: (data) => {
      qc.setQueryData(codingProblemKey(id), data);
      void qc.invalidateQueries({ queryKey: ['codingProblems'] });
    },
  });
}

export function useDeleteCodingProblem(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCodingProblem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: codingProblemsKey(courseId) });
      void qc.invalidateQueries({ queryKey: ['codingProblems'] });
    },
  });
}

export function useUpsertTestCase(problemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertTestCaseRequest) => api.upsertTestCase(problemId, body),
    onSuccess: (data) => qc.setQueryData(codingProblemKey(problemId), data),
  });
}

export function useDeleteTestCase(problemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testCaseId: string) => api.deleteTestCase(problemId, testCaseId),
    onSuccess: (data) => qc.setQueryData(codingProblemKey(problemId), data),
  });
}

// --- Student (làm bài) ---

export const codingForClassKey = (classId: string) => ['codingForClass', classId] as const;
export const codingAttemptKey = (problemId: string, classId: string) =>
  ['codingAttempt', problemId, classId] as const;
export const codingSubmissionKey = (id: string) => ['codingSubmission', id] as const;

export function useCodingProblemsForClass(classId: string | null) {
  return useQuery({
    queryKey: codingForClassKey(classId ?? '_none'),
    queryFn: () => api.listCodingProblemsForClass(classId as string),
    enabled: !!classId,
  });
}

export function useCodingAttempt(problemId: string | null, classId: string | null) {
  return useQuery({
    queryKey: codingAttemptKey(problemId ?? '_none', classId ?? '_none'),
    queryFn: () => api.getCodingAttempt(problemId as string, classId as string),
    enabled: !!problemId && !!classId,
  });
}

export function useSubmitCoding(problemId: string) {
  return useMutation({
    mutationFn: (body: SubmitCodingRequest) => api.submitCoding(problemId, body),
  });
}

/**
 * Poll một submission tới khi trạng thái terminal (passed/failed/error). Inline driver trả kết quả
 * ngay; bull driver bắt đầu ở queued/running nên cần polling ~1.5s.
 */
export function useCodingSubmission(submissionId: string | null) {
  return useQuery<CodingSubmissionDto>({
    queryKey: codingSubmissionKey(submissionId ?? '_none'),
    queryFn: () => api.getCodingSubmission(submissionId as string),
    enabled: !!submissionId,
    refetchInterval: (query) => (isTerminal(query.state.data?.status) ? false : 1500),
  });
}
