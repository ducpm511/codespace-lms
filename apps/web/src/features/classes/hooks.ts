import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignCourseRequest,
  CreateClassRequest,
  EnrollMemberRequest,
  ProgressStatusValue,
  SetLessonGateRequest,
  UpdateClassRequest,
} from '@lms/contracts';
import * as api from './api';

export const classesKey = ['classes'] as const;
export const myClassesKey = ['classes', 'mine'] as const;
export const classKey = (id: string) => ['classes', id] as const;
export const gatesKey = (id: string) => ['classes', id, 'gates'] as const;
export const myLessonsKey = (id: string) => ['classes', id, 'my-lessons'] as const;

export function useClasses() {
  return useQuery({ queryKey: classesKey, queryFn: api.listClasses });
}

export function useMyClasses() {
  return useQuery({ queryKey: myClassesKey, queryFn: api.listMyClasses });
}

export function useClass(id: string | null) {
  return useQuery({
    queryKey: classKey(id ?? '_none'),
    queryFn: () => api.getClass(id as string),
    enabled: !!id,
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClassRequest) => api.createClass(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: classesKey }),
  });
}

export function useUpdateClass(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClassRequest) => api.updateClass(classId, body),
    onSuccess: (data) => {
      qc.setQueryData(classKey(classId), data);
      // Tên/trạng thái lớp hiện cả ở sidebar -> danh sách phải làm mới theo.
      void qc.invalidateQueries({ queryKey: classesKey });
    },
  });
}

/** Gỡ khóa học khỏi lớp. Tiến độ đã ghi nhận KHÔNG mất — chỉ bỏ liên kết. */
export function useUnassignCourse(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api.unassignCourse(classId, courseId),
    onSuccess: (data) => {
      qc.setQueryData(classKey(classId), data);
      // Gate bám theo bài của khóa vừa gỡ -> buộc nạp lại thay vì hiện danh sách cũ.
      void qc.invalidateQueries({ queryKey: gatesKey(classId) });
    },
  });
}

export function useAssignCourse(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignCourseRequest) => api.assignCourse(classId, body),
    onSuccess: (data) => qc.setQueryData(classKey(classId), data),
  });
}

export function useEnrollMember(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EnrollMemberRequest) => api.enrollMember(classId, body),
    onSuccess: (data) => qc.setQueryData(classKey(classId), data),
  });
}

export function useGates(classId: string | null) {
  return useQuery({
    queryKey: gatesKey(classId ?? '_none'),
    queryFn: () => api.listGates(classId as string),
    enabled: !!classId,
  });
}

export function useSetGate(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetLessonGateRequest) => api.setGate(classId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: gatesKey(classId) }),
  });
}

export function useMyLessons(classId: string | null) {
  return useQuery({
    queryKey: myLessonsKey(classId ?? '_none'),
    queryFn: () => api.getMyLessons(classId as string),
    enabled: !!classId,
  });
}

export function useUpdateProgress(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lessonId: string; status: ProgressStatusValue }) =>
      api.updateProgress(classId, vars.lessonId, { status: vars.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: myLessonsKey(classId) });
      // Hoàn thành bài là cộng XP → hero cấp độ và bảng xếp hạng tuần phải đổi theo ngay,
      // nếu không học viên thấy điểm đứng yên và tưởng hệ thống không ghi nhận.
      void qc.invalidateQueries({ queryKey: ['gamification', 'me'] });
      void qc.invalidateQueries({ queryKey: ['classes', classId, 'leaderboard'] });
    },
  });
}
