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
  UpdateClassRequest,
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

// Gỡ thành viên = ĐÁNH DẤU `status: removed` ở backend, KHÔNG xoá bản ghi. Tiến độ học, bài nộp
// và điểm của em vẫn còn nguyên — thêm lại là thấy lại.
export const removeMember = (classId: string, userId: string): Promise<ClassDetail> =>
  apiFetch<ClassDetail>(`/classes/${classId}/members/${userId}`, { method: 'DELETE' });

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

export const updateClass = (id: string, body: UpdateClassRequest): Promise<ClassDetail> =>
  apiFetch<ClassDetail>(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/** Gỡ một khóa học khỏi lớp. Không xóa khóa học, chỉ bỏ liên kết với lớp. */
export const unassignCourse = (classId: string, courseId: string): Promise<ClassDetail> =>
  apiFetch<ClassDetail>(`/classes/${classId}/courses/${courseId}`, { method: 'DELETE' });
