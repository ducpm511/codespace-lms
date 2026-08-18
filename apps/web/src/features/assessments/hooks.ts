import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAssignmentRequest,
  GradeSubmissionRequest,
  SaveSubmissionRequest,
} from '@lms/contracts';
import * as api from './api';

export const assignmentsKey = (courseId?: string) => ['assignments', courseId ?? '_all'] as const;
export const assignmentKey = (id: string) => ['assignment', id] as const;
export const submissionsKey = (classId: string, assignmentId: string, status?: string) =>
  ['submissions', classId, assignmentId, status ?? '_all'] as const;
export const mySubmissionKey = (assignmentId: string, classId: string) =>
  ['mySubmission', assignmentId, classId] as const;

export function useAssignments(courseId?: string) {
  return useQuery({
    queryKey: assignmentsKey(courseId),
    queryFn: () => api.listAssignments(courseId),
  });
}

export const assignmentsForClassKey = (classId: string) => ['assignments', 'for-class', classId] as const;

export function useAssignmentsForClass(classId: string | null) {
  return useQuery({
    queryKey: assignmentsForClassKey(classId ?? '_none'),
    queryFn: () => api.listAssignmentsForClass(classId as string),
    enabled: !!classId,
  });
}

export function useAssignment(id: string | null) {
  return useQuery({
    queryKey: assignmentKey(id ?? '_none'),
    queryFn: () => api.getAssignment(id as string),
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAssignmentRequest) => api.createAssignment(body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: assignmentsKey(res.courseId) });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useDeleteAssignment(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAssignment(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assignmentsKey(courseId) });
      void qc.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useSubmissions(classId: string | null, assignmentId: string | null, status?: string) {
  return useQuery({
    queryKey: submissionsKey(classId ?? '_none', assignmentId ?? '_none', status),
    queryFn: () => api.listSubmissions(classId as string, assignmentId as string, status),
    enabled: !!classId && !!assignmentId,
  });
}

export function useGradeSubmission(classId: string, assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { submissionId: string; body: GradeSubmissionRequest }) =>
      api.gradeSubmission(vars.submissionId, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: submissionsKey(classId, assignmentId) });
      void qc.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
}

export function useMySubmission(assignmentId: string | null, classId: string | null) {
  return useQuery({
    queryKey: mySubmissionKey(assignmentId ?? '_none', classId ?? '_none'),
    queryFn: () => api.getMySubmission(assignmentId as string, classId as string),
    enabled: !!assignmentId && !!classId,
  });
}

export function useSaveSubmission(assignmentId: string, classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveSubmissionRequest) => api.saveSubmission(assignmentId, body),
    onSuccess: (data) => {
      qc.setQueryData(mySubmissionKey(assignmentId, classId), data);
    },
  });
}

export function useSubmitSubmission(assignmentId: string, classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { classId: string }) => api.submitSubmission(assignmentId, body),
    onSuccess: (data) => {
      qc.setQueryData(mySubmissionKey(assignmentId, classId), data);
    },
  });
}
