import { API_BASE } from './queryClient';

// Access token giữ TRONG BỘ NHỚ (không localStorage) — refresh qua cookie httpOnly do backend set.
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function request(path: string, options: RequestInit = {}, json = true): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // gửi/nhận cookie refresh
    headers: {
      // multipart: KHÔNG set Content-Type để browser tự sinh boundary.
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

// Gộp nhiều 401 đồng thời vào 1 lần refresh.
let refreshing: Promise<boolean> | null = null;
function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = request('/auth/refresh', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string };
        setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Fetch có gắn Bearer + tự refresh 1 lần khi gặp 401. Ném ApiError(status, message) khi lỗi. */
export async function apiFetch<T>(path: string, options: RequestInit = {}, retryOn401 = true): Promise<T> {
  let res = await request(path, options);

  if (res.status === 401 && retryOn401 && path !== '/auth/refresh') {
    const ok = await tryRefresh();
    if (ok) {
      res = await request(path, options);
    }
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // giữ statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

async function requestWithRefresh(path: string, options: RequestInit, json: boolean): Promise<Response> {
  let res = await request(path, options, json);
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) {
      res = await request(path, options, json);
    }
  }
  return res;
}

async function throwApiError(res: Response): Promise<never> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body?.message) {
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }
  } catch {
    // giữ statusText
  }
  throw new ApiError(res.status, message);
}

/** Upload multipart (FormData). Không set Content-Type — browser tự thêm boundary. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await requestWithRefresh(path, { method: 'POST', body: form }, false);
  if (!res.ok) {
    await throwApiError(res);
  }
  return (await res.json()) as T;
}

/**
 * Tải nội dung nhị phân private (vd `GET /files/:id`) và trả về object URL.
 * `<iframe src>` không gửi được header Authorization nên phải fetch có Bearer rồi nhúng blob URL.
 * Caller PHẢI gọi `URL.revokeObjectURL` khi unmount.
 */
export async function apiFetchObjectUrl(path: string): Promise<string> {
  const res = await requestWithRefresh(path, { method: 'GET' }, false);
  if (!res.ok) {
    await throwApiError(res);
  }
  return URL.createObjectURL(await res.blob());
}
