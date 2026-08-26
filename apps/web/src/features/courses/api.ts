import type {
  CourseDetail,
  CourseSummary,
  CreateCourseRequest,
  CreateLessonRequest,
  CreateSectionRequest,
  Paginated,
  UpdateCourseRequest,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const listCourses = (): Promise<Paginated<CourseSummary>> =>
  apiFetch<Paginated<CourseSummary>>('/courses?page=1&pageSize=100');

export const getCourse = (id: string): Promise<CourseDetail> => apiFetch<CourseDetail>(`/courses/${id}`);

export const createCourse = (body: CreateCourseRequest): Promise<CourseDetail> =>
  apiFetch<CourseDetail>('/courses', { method: 'POST', body: JSON.stringify(body) });

export const addSection = (courseId: string, body: CreateSectionRequest): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections`, { method: 'POST', body: JSON.stringify(body) });

export const updateSection = (
  courseId: string,
  sectionId: string,
  body: { title?: string; order?: number },
): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections/${sectionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const removeSection = (courseId: string, sectionId: string): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections/${sectionId}`, {
    method: 'DELETE',
  });

export const addLesson = (
  courseId: string,
  sectionId: string,
  body: CreateLessonRequest,
): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections/${sectionId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateLesson = (
  courseId: string,
  sectionId: string,
  lessonId: string,
  body: { title?: string; order?: number; type?: string; durationSec?: number | null },
): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const removeLesson = (
  courseId: string,
  sectionId: string,
  lessonId: string,
): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}`, {
    method: 'DELETE',
  });

export const publishCourse = (id: string): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${id}/publish`, { method: 'POST' });

export const updateCourse = (id: string, body: UpdateCourseRequest): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteCourse = (id: string): Promise<void> =>
  apiFetch<void>(`/courses/${id}`, { method: 'DELETE' });
