import type {
  CreateLessonActivityRequest,
  FileUploadResponse,
  LessonActivityDto,
  LessonDetail,
  ReorderLessonActivitiesRequest,
  UpdateLessonActivityRequest,
} from '@lms/contracts';
import { apiFetch, apiUpload } from '../../lib/api';

const base = (courseId: string, sectionId: string, lessonId: string) =>
  `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}`;

export const getLessonDetail = (
  courseId: string,
  sectionId: string,
  lessonId: string,
): Promise<LessonDetail> => apiFetch<LessonDetail>(base(courseId, sectionId, lessonId));

export const addActivity = (
  courseId: string,
  sectionId: string,
  lessonId: string,
  body: CreateLessonActivityRequest,
): Promise<LessonActivityDto[]> =>
  apiFetch<LessonActivityDto[]>(`${base(courseId, sectionId, lessonId)}/activities`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateActivity = (
  courseId: string,
  sectionId: string,
  lessonId: string,
  activityId: string,
  body: UpdateLessonActivityRequest,
): Promise<LessonActivityDto[]> =>
  apiFetch<LessonActivityDto[]>(`${base(courseId, sectionId, lessonId)}/activities/${activityId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const removeActivity = (
  courseId: string,
  sectionId: string,
  lessonId: string,
  activityId: string,
): Promise<LessonActivityDto[]> =>
  apiFetch<LessonActivityDto[]>(`${base(courseId, sectionId, lessonId)}/activities/${activityId}`, {
    method: 'DELETE',
  });

export const reorderActivities = (
  courseId: string,
  sectionId: string,
  lessonId: string,
  body: ReorderLessonActivitiesRequest,
): Promise<LessonActivityDto[]> =>
  apiFetch<LessonActivityDto[]>(`${base(courseId, sectionId, lessonId)}/activities/reorder`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

/** Upload PDF slide — backend chặn mime/dung lượng, trả về File private. */
export const uploadFile = (file: File): Promise<FileUploadResponse> => {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<FileUploadResponse>('/files', form);
};
