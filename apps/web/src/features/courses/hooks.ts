import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCourseRequest,
  CreateLessonRequest,
  CreateSectionRequest,
  UpdateCourseRequest,
} from '@lms/contracts';
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

export function useUpdateSection(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sectionId: string; body: { title?: string; order?: number } }) =>
      api.updateSection(courseId, vars.sectionId, vars.body),
    onSuccess: (data) => qc.setQueryData(courseKey(courseId), data),
  });
}

export function useRemoveSection(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sectionId: string) => api.removeSection(courseId, sectionId),
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

export function useUpdateLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      sectionId: string;
      lessonId: string;
      body: { title?: string; order?: number; type?: string; durationSec?: number | null };
    }) => api.updateLesson(courseId, vars.sectionId, vars.lessonId, vars.body),
    onSuccess: (data) => qc.setQueryData(courseKey(courseId), data),
  });
}

export function useRemoveLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sectionId: string; lessonId: string }) =>
      api.removeLesson(courseId, vars.sectionId, vars.lessonId),
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

export function useUpdateCourse(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCourseRequest) => api.updateCourse(courseId, body),
    onSuccess: (data) => {
      qc.setQueryData(courseKey(courseId), data);
      // Danh sách bên trái hiện title + slug -> phải nạp lại, nếu không tên cũ còn nằm đó.
      void qc.invalidateQueries({ queryKey: coursesKey });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api.deleteCourse(courseId),
    onSuccess: (_data, courseId) => {
      qc.removeQueries({ queryKey: courseKey(courseId) });
      void qc.invalidateQueries({ queryKey: coursesKey });
    },
  });
}
