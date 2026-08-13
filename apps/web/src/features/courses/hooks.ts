import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCourseRequest, CreateLessonRequest, CreateSectionRequest } from '@lms/contracts';
import * as api from './api';

export const coursesKey = ['courses'] as const;
export const courseKey = (id: string) => ['courses', id] as const;

export function useCourses() {
  return useQuery({ queryKey: coursesKey, queryFn: api.listCourses });
}

export function useCourse(id: string | null) {
  return useQuery({
    queryKey: courseKey(id ?? '_none'),
    queryFn: () => api.getCourse(id as string),
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCourseRequest) => api.createCourse(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: coursesKey }),
  });
}

export function useAddSection(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSectionRequest) => api.addSection(courseId, body),
    onSuccess: (data) => qc.setQueryData(courseKey(courseId), data),
  });
}

export function useAddLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sectionId: string; body: CreateLessonRequest }) =>
      api.addLesson(courseId, vars.sectionId, vars.body),
    onSuccess: (data) => qc.setQueryData(courseKey(courseId), data),
  });
}

export function usePublishCourse(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.publishCourse(courseId),
    onSuccess: (data) => {
      qc.setQueryData(courseKey(courseId), data);
      void qc.invalidateQueries({ queryKey: coursesKey });
    },
  });
}
