import type {
  AssignCourseRequest,
  ClassDetail,
  ClassSummary,
  CreateClassRequest,
  EnrollMemberRequest,
  LessonGateDto,
  LessonProgressDto,
  MyLessonDto,
  Paginated,
  SetLessonGateRequest,
  UpdateProgressRequest,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export const listClasses = (): Promise<Paginated<ClassSummary>> =>
  apiFetch<Paginated<ClassSummary>>('/classes?page=1&pageSize=100');

export const listMyClasses = (): Promise<ClassSummary[]> => apiFetch<ClassSummary[]>('/classes/mine');

export const getClass = (id: string): Promise<ClassDetail> => apiFetch<ClassDetail>(`/classes/${id}`);

export const createClass = (body: CreateClassRequest): Promise<ClassDetail> =>
  apiFetch<ClassDetail>('/classes', { method: 'POST', body: JSON.stringify(body) });

export const assignCourse = (classId: string, body: AssignCourseRequest): Promise<ClassDetail> =>
  apiFetch<ClassDetail>(`/classes/${classId}/courses`, { method: 'POST', body: JSON.stringify(body) });

export const enrollMember = (classId: string, body: EnrollMemberRequest): Promise<ClassDetail> =>
  apiFetch<ClassDetail>(`/classes/${classId}/members`, { method: 'POST', body: JSON.stringify(body) });

export const listGates = (classId: string): Promise<LessonGateDto[]> =>
  apiFetch<LessonGateDto[]>(`/classes/${classId}/gates`);

export const setGate = (classId: string, body: SetLessonGateRequest): Promise<LessonGateDto> =>
  apiFetch<LessonGateDto>(`/classes/${classId}/gates`, { method: 'PUT', body: JSON.stringify(body) });

export const getMyLessons = (classId: string): Promise<MyLessonDto[]> =>
  apiFetch<MyLessonDto[]>(`/classes/${classId}/my-lessons`);

export const updateProgress = (
  classId: string,
  lessonId: string,
  body: UpdateProgressRequest,
): Promise<LessonProgressDto> =>
  apiFetch<LessonProgressDto>(`/classes/${classId}/lessons/${lessonId}/progress`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
