import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CodingSubmissionDto,
  CreateCodingProblemRequest,
  SubmitCodingRequest,
  UpdateCodingProblemRequest,
  UpsertTestCaseRequest,
} from '@lms/contracts';
import { myLessonsKey } from '../classes/hooks';
import * as api from './api';
import { invalidateLearningProgress } from '../classes/hooks';

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
      // Tên bài hiện trong builder bài học (`refTitle`).
      void qc.invalidateQueries({ queryKey: ['lesson-detail'] });
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
      void qc.invalidateQueries({ queryKey: ['lesson-detail'] });
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
    // Luôn đọc lại khi mở bài: code và kết quả có thể vừa được nộp từ máy khác.
    staleTime: 0,
  });
}

/** Chấm xong là trạng thái bài, tiến độ bài học, XP và bảng xếp hạng đều đổi; không làm mới thì vào lại vẫn thấy cũ. */
export function useRefreshAfterGraded(problemId: string, classId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: codingAttemptKey(problemId, classId) });
    void qc.invalidateQueries({ queryKey: codingForClassKey(classId) });
    void qc.invalidateQueries({ queryKey: myLessonsKey(classId) });
    void qc.invalidateQueries({ queryKey: ['gamification', 'me'] });
    void qc.invalidateQueries({ queryKey: ['classes', classId, 'leaderboard'] });
    void qc.invalidateQueries({ queryKey: ['studentOwnGradebook', classId] });
  };
}

export function useSubmitCoding(problemId: string) {
  return useMutation({
    mutationFn: (body: SubmitCodingRequest) => api.submitCoding(problemId, body),
  });
}

// --- Giáo viên xem bài nộp theo lớp ---

export function useClassCodingOverview(classId: string | null) {
  return useQuery({
    queryKey: ['classCoding', classId ?? '_none'],
    queryFn: () => api.getClassCodingOverview(classId as string),
    enabled: !!classId,
    // 403 (không phụ trách lớp) là kết quả, không phải lỗi mạng: thử lại chỉ làm giáo viên chờ lâu hơn.
    retry: false,
  });
}

export function useClassProblemSubmissions(classId: string | null, problemId: string | null) {
  return useQuery({
    queryKey: ['classCoding', classId ?? '_none', problemId ?? '_none'],
    queryFn: () => api.getClassProblemSubmissions(classId as string, problemId as string),
    enabled: !!classId && !!problemId,
    // Mở lại phải thấy bài vừa nộp, học viên có thể đang làm ngay trong giờ.
    staleTime: 0,
    retry: false,
  });
}

export function useCodingSubmissionReview(submissionId: string | null) {
  return useQuery({
    queryKey: ['codingSubmissionReview', submissionId ?? '_none'],
    queryFn: () => api.getCodingSubmissionReview(submissionId as string),
    enabled: !!submissionId,
    retry: false,
    refetchInterval: (query) => (query.state.data && !isTerminal(query.state.data.status) ? 1500 : false),
  });
}

/**
 * Poll một submission tới khi trạng thái terminal (passed/failed/error). Inline driver trả kết quả
 * ngay; bull driver bắt đầu ở queued/running nên cần polling ~1.5s.
 */
export function useCodingSubmission(submissionId: string | null) {
  const qc = useQueryClient();
  const query = useQuery<CodingSubmissionDto>({
    queryKey: codingSubmissionKey(submissionId ?? '_none'),
    queryFn: () => api.getCodingSubmission(submissionId as string),
    enabled: !!submissionId,
    refetchInterval: (query) => (isTerminal(query.state.data?.status) ? false : 1500),
  });

  // Tiến độ và XP chỉ đổi khi chấm xong, không phải lúc gửi bài.
  const gradedClassId = isTerminal(query.data?.status) ? query.data?.classId : null;
  useEffect(() => {
    if (gradedClassId) invalidateLearningProgress(qc, gradedClassId);
  }, [qc, gradedClassId, submissionId]);

  return query;
}
