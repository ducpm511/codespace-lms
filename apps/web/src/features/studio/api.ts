import type {
  CreateScratchProjectRequest,
  ScratchClassDto,
  ScratchGalleryScope,
  ScratchLikeResponse,
  ScratchAssetUploadResponse,
  ScratchProjectDetailDto,
  ScratchProjectSummaryDto,
  ScratchProjectVersionDto,
  UpdateScratchProjectRequest,
} from '@lms/contracts';
import { ApiError, apiFetch, apiFetchArrayBuffer, apiUpload } from '../../lib/api';

const base = '/scratch/projects';

export const listMyProjects = (): Promise<ScratchProjectSummaryDto[]> => apiFetch(`${base}/mine`);

export const getProject = (id: string): Promise<ScratchProjectDetailDto> => apiFetch(`${base}/${id}`);

export const createProject = (dto: CreateScratchProjectRequest): Promise<ScratchProjectDetailDto> =>
  apiFetch(base, { method: 'POST', body: JSON.stringify(dto) });

export const updateProject = (id: string, dto: UpdateScratchProjectRequest): Promise<ScratchProjectDetailDto> =>
  apiFetch(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });

export const deleteProject = (id: string): Promise<void> => apiFetch(`${base}/${id}`, { method: 'DELETE' });

/** project.json mới nhất; `null` = dự án chưa lưu lần nào. */
export async function getLatestProjectJson(id: string): Promise<string | null> {
  try {
    return JSON.stringify(await apiFetch<unknown>(`${base}/${id}/versions/latest`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const getProjectAsset = (id: string, md5ext: string): Promise<ArrayBuffer | null> =>
  apiFetchArrayBuffer(`${base}/${id}/assets/${md5ext}`);

export function saveProjectVersion(id: string, projectJson: string): Promise<ScratchProjectVersionDto> {
  const form = new FormData();
  form.append('project', new Blob([projectJson], { type: 'application/json' }), 'project.json');
  return apiUpload(`${base}/${id}/versions`, form);
}

export function uploadAsset(md5ext: string, data: ArrayBuffer): Promise<ScratchAssetUploadResponse> {
  const form = new FormData();
  form.append('file', new Blob([data]), md5ext);
  return apiUpload(`/scratch/assets/${md5ext}`, form);
}

// --- Chia sẻ (T11.5) ---

export const listScratchClasses = (): Promise<ScratchClassDto[]> => apiFetch('/scratch/classes');

export const listGallery = (scope: ScratchGalleryScope, classId?: string): Promise<ScratchProjectSummaryDto[]> =>
  apiFetch(`/scratch/gallery?scope=${scope}${classId ? `&classId=${encodeURIComponent(classId)}` : ''}`);

export const remixProject = (id: string, title?: string): Promise<ScratchProjectDetailDto> =>
  apiFetch(`${base}/${id}/remix`, { method: 'POST', body: JSON.stringify(title ? { title } : {}) });

export const setProjectLike = (id: string, liked: boolean): Promise<ScratchLikeResponse> =>
  apiFetch(`${base}/${id}/like`, { method: liked ? 'PUT' : 'DELETE' });
