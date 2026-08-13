import type {
  CourseDetail,
  CourseSummary,
  CreateCourseRequest,
  CreateLessonRequest,
  CreateSectionRequest,
  Paginated,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const listCourses = (): Promise<Paginated<CourseSummary>> =>
  apiFetch<Paginated<CourseSummary>>('/courses?page=1&pageSize=100');

export const getCourse = (id: string): Promise<CourseDetail> => apiFetch<CourseDetail>(`/courses/${id}`);

export const createCourse = (body: CreateCourseRequest): Promise<CourseDetail> =>
  apiFetch<CourseDetail>('/courses', { method: 'POST', body: JSON.stringify(body) });

export const addSection = (courseId: string, body: CreateSectionRequest): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections`, { method: 'POST', body: JSON.stringify(body) });

export const addLesson = (
  courseId: string,
  sectionId: string,
  body: CreateLessonRequest,
): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${courseId}/sections/${sectionId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const publishCourse = (id: string): Promise<CourseDetail> =>
  apiFetch<CourseDetail>(`/courses/${id}/publish`, { method: 'POST' });
