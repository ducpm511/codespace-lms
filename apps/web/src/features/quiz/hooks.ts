import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateQuizRequest,
  SubmitQuizAttemptRequest,
  UpdateQuizRequest,
  UpsertQuestionRequest,
} from '@lms/contracts';
import * as api from './api';

// --- Authoring ---

export const quizzesKey = (courseId?: string) => ['quizzes', courseId ?? '_all'] as const;
export const quizKey = (id: string) => ['quiz', id] as const;

export function useQuizzes(courseId?: string) {
  return useQuery({
    queryKey: quizzesKey(courseId),
    queryFn: () => api.listQuizzes(courseId),
  });
}

export function useQuiz(id: string | null) {
  return useQuery({
    queryKey: quizKey(id ?? '_none'),
    queryFn: () => api.getQuiz(id as string),
    enabled: !!id,
  });
}

export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateQuizRequest) => api.createQuiz(body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: quizzesKey(res.courseId) });
      void qc.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}

export function useUpdateQuiz(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateQuizRequest) => api.updateQuiz(id, body),
    onSuccess: (data) => {
      qc.setQueryData(quizKey(id), data);
      void qc.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}

export function useDeleteQuiz(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteQuiz(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: quizzesKey(courseId) });
      void qc.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}

export function useUpsertQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertQuestionRequest) => api.upsertQuestion(quizId, body),
    onSuccess: (data) => {
      qc.setQueryData(quizKey(quizId), data);
      void qc.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}

export function useDeleteQuestion(quizId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => api.deleteQuestion(quizId, questionId),
    onSuccess: (data) => {
      qc.setQueryData(quizKey(quizId), data);
      void qc.invalidateQueries({ queryKey: ['quizzes'] });
    },
  });
}

// --- Student (làm bài) ---

export const quizForClassKey = (classId: string) => ['quizForClass', classId] as const;
export const quizAttemptKey = (quizId: string, classId: string) =>
  ['quizAttempt', quizId, classId] as const;

export function useQuizzesForClass(classId: string | null) {
  return useQuery({
    queryKey: quizForClassKey(classId ?? '_none'),
    queryFn: () => api.listQuizzesForClass(classId as string),
    enabled: !!classId,
  });
}

export function useQuizAttempt(quizId: string | null, classId: string | null) {
  return useQuery({
    queryKey: quizAttemptKey(quizId ?? '_none', classId ?? '_none'),
    queryFn: () => api.getQuizAttempt(quizId as string, classId as string),
    enabled: !!quizId && !!classId,
  });
}

/** Nộp + chấm server-side trong một lần; trả về QuizAttemptDto đã chấm. */
export function useSubmitQuizAttempt(quizId: string) {
  return useMutation({
    mutationFn: (body: SubmitQuizAttemptRequest) => api.submitQuizAttempt(quizId, body),
  });
}
