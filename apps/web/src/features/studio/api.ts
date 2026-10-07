import type {
  CreateScratchReportRequest,
  CreateScratchProjectRequest,
  RequestScratchPublicationRequest,
  ScratchModerationQueueDto,
  ScratchNicknameDto,
  ScratchPublicationDto,
  ScratchPublicProjectDto,
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

// --- Công khai, biệt danh, báo cáo, kiểm duyệt (T11.5b) ---

/** project.json dạng chuỗi; 404 ⇒ null. */
async function jsonOrNull(path: string): Promise<string | null> {
  try {
    return JSON.stringify(await apiFetch<unknown>(path));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const getMyNickname = (): Promise<ScratchNicknameDto> => apiFetch('/scratch/me/nickname');

export const requestPublication = (id: string, dto: RequestScratchPublicationRequest): Promise<ScratchPublicationDto> =>
  apiFetch(`${base}/${id}/publication`, { method: 'POST', body: JSON.stringify(dto) });

export const withdrawPublication = (id: string): Promise<ScratchPublicationDto | null> =>
  apiFetch(`${base}/${id}/publication`, { method: 'DELETE' });

export const reportProject = (id: string, dto: CreateScratchReportRequest): Promise<void> =>
  apiFetch(`${base}/${id}/report`, { method: 'POST', body: JSON.stringify(dto) });

const pub = (slug: string) => `/scratch/public/${encodeURIComponent(slug)}`;
export const getPublicProject = (slug: string): Promise<ScratchPublicProjectDto> => apiFetch(pub(slug));
export const getPublicProjectJson = (slug: string): Promise<string | null> => jsonOrNull(`${pub(slug)}/project.json`);
export const getPublicAsset = (slug: string, md5ext: string): Promise<ArrayBuffer | null> =>
  apiFetchArrayBuffer(`${pub(slug)}/assets/${md5ext}`);
export const remixPublic = (slug: string): Promise<ScratchProjectDetailDto> =>
  apiFetch(`${pub(slug)}/remix`, { method: 'POST' });
export const reportPublic = (slug: string, dto: CreateScratchReportRequest): Promise<void> =>
  apiFetch(`${pub(slug)}/report`, { method: 'POST', body: JSON.stringify(dto) });

const mod = '/scratch/moderation';
export const getModerationQueue = (): Promise<ScratchModerationQueueDto> => apiFetch(`${mod}/queue`);
export const getRequestedJson = (projectId: string): Promise<string | null> =>
  jsonOrNull(`${mod}/publications/${projectId}/project.json`);
export const getRequestedAsset = (projectId: string, md5ext: string): Promise<ArrayBuffer | null> =>
  apiFetchArrayBuffer(`${mod}/publications/${projectId}/assets/${md5ext}`);
export const decidePublication = (projectId: string, decision: 'approve' | 'reject' | 'remove', note?: string) =>
  apiFetch<void>(`${mod}/publications/${projectId}/${decision}`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
export const decideNickname = (userId: string, decision: 'approve' | 'reject') =>
  apiFetch<void>(`${mod}/nicknames/${userId}/${decision}`, { method: 'POST' });
export const resolveReport = (id: string, action: 'dismiss' | 'remove') =>
  apiFetch<void>(`${mod}/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action }) });
