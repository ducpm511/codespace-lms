import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateScratchProjectRequest } from '@lms/contracts';
import { createProject, deleteProject, getProject, listMyProjects, updateProject } from './api';

export const studioKeys = {
  mine: ['scratch-projects', 'mine'] as const,
  project: (id: string) => ['scratch-projects', id] as const,
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
