import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateLessonActivityRequest,
  LessonActivityDto,
  LessonDetail,
  UpdateLessonActivityRequest,
} from '@lms/contracts';
import { courseKey } from '../courses/hooks';
import * as api from './api';

export const lessonDetailKey = (courseId: string, sectionId: string, lessonId: string) =>
  ['lesson-detail', courseId, sectionId, lessonId] as const;

export function useLessonDetail(courseId: string, sectionId: string, lessonId: string | null) {
  return useQuery({
    queryKey: lessonDetailKey(courseId, sectionId, lessonId ?? '_none'),
    queryFn: () => api.getLessonDetail(courseId, sectionId, lessonId as string),
    enabled: !!lessonId,
  });
}

/** Mọi mutation activity trả về danh sách mới → ghi thẳng vào cache lessonDetail. */
function useActivityMutation<TVars>(
  courseId: string,
  sectionId: string,
  lessonId: string,
  mutationFn: (vars: TVars) => Promise<LessonActivityDto[]>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (activities) => {
      qc.setQueryData(lessonDetailKey(courseId, sectionId, lessonId), (prev?: LessonDetail) =>
        prev ? { ...prev, activities, activityCount: activities.length } : prev,
      );
      // badge số activity ở cây khóa học
      void qc.invalidateQueries({ queryKey: courseKey(courseId) });
    },
  });
}

export function useAddActivity(courseId: string, sectionId: string, lessonId: string) {
  return useActivityMutation(courseId, sectionId, lessonId, (body: CreateLessonActivityRequest) =>
    api.addActivity(courseId, sectionId, lessonId, body),
  );
}

export function useUpdateActivity(courseId: string, sectionId: string, lessonId: string) {
  return useActivityMutation(
    courseId,
    sectionId,
    lessonId,
    (vars: { activityId: string; body: UpdateLessonActivityRequest }) =>
      api.updateActivity(courseId, sectionId, lessonId, vars.activityId, vars.body),
  );
}

export function useRemoveActivity(courseId: string, sectionId: string, lessonId: string) {
  return useActivityMutation(courseId, sectionId, lessonId, (activityId: string) =>
    api.removeActivity(courseId, sectionId, lessonId, activityId),
  );
}

export function useReorderActivities(courseId: string, sectionId: string, lessonId: string) {
  return useActivityMutation(courseId, sectionId, lessonId, (activityIds: string[]) =>
    api.reorderActivities(courseId, sectionId, lessonId, { activityIds }),
  );
}

export function useUploadFile() {
  return useMutation({ mutationFn: (file: File) => api.uploadFile(file) });
}
