import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCodingProblemRequest,
  UpdateCodingProblemRequest,
  UpsertTestCaseRequest,
} from '@lms/contracts';
import * as api from './api';

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
