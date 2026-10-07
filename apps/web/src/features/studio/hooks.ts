import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScratchGalleryScope, ScratchProjectDetailDto, UpdateScratchProjectRequest } from '@lms/contracts';
import {
  createProject,
  deleteProject,
  getProject,
  listGallery,
  listMyProjects,
  listScratchClasses,
  remixProject,
  setProjectLike,
  updateProject,
} from './api';

export const studioKeys = {
  mine: ['scratch-projects', 'mine'] as const,
  project: (id: string) => ['scratch-projects', id] as const,
  classes: ['scratch-classes'] as const,
  gallery: (scope: ScratchGalleryScope, classId?: string) => ['scratch-gallery', scope, classId ?? ''] as const,
};

export function useMyProjects() {
  return useQuery({ queryKey: studioKeys.mine, queryFn: listMyProjects });
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: studioKeys.project(id ?? ''), queryFn: () => getProject(id!), enabled: Boolean(id) });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: studioKeys.mine }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateScratchProjectRequest) => updateProject(id, dto),
    onSuccess: (detail) => {
      qc.setQueryData(studioKeys.project(id), detail);
      void qc.invalidateQueries({ queryKey: studioKeys.mine });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: studioKeys.mine }),
  });
}

/** Lớp mình chia sẻ vào / xem gallery được (thành viên hoặc người tạo lớp). */
export function useScratchClasses() {
  return useQuery({ queryKey: studioKeys.classes, queryFn: listScratchClasses });
}

export function useGallery(scope: ScratchGalleryScope | null, classId?: string) {
  return useQuery({
    queryKey: studioKeys.gallery(scope ?? 'school', classId),
    queryFn: () => listGallery(scope!, classId),
    enabled: scope !== null && (scope === 'school' || Boolean(classId)),
  });
}

export function useRemixProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remixProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: studioKeys.mine }),
  });
}

/** Thích / bỏ thích — cập nhật ngay trên màn hình, lỗi thì trả lại như cũ. */
export function useLikeProject(id: string) {
  const qc = useQueryClient();
  const key = studioKeys.project(id);
  return useMutation({
    mutationFn: (liked: boolean) => setProjectLike(id, liked),
    onMutate: async (liked) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ScratchProjectDetailDto>(key);
      if (prev && prev.likedByMe !== liked) {
        qc.setQueryData<ScratchProjectDetailDto>(key, {
          ...prev,
          likedByMe: liked,
          likeCount: prev.likeCount + (liked ? 1 : -1),
        });
      }
      return { prev };
    },
    onError: (_e, _liked, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (res) => {
      const cur = qc.getQueryData<ScratchProjectDetailDto>(key);
      if (cur) qc.setQueryData<ScratchProjectDetailDto>(key, { ...cur, ...res });
      void qc.invalidateQueries({ queryKey: ['scratch-gallery'] });
    },
  });
}
