import { VIDEO_EMBED_HOSTS } from '@lms/contracts';

/**
 * Chỉ cho phép nhúng video từ host trong allowlist (INVARIANT P7 — chống clickjacking/inject qua iframe).
 * Bắt buộc http(s); so khớp hostname chính xác (không dùng `endsWith` để tránh `evil-youtube.com`).
 */
export function isAllowedVideoUrl(raw: string | null | undefined): boolean {
  if (!raw) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }
  return VIDEO_EMBED_HOSTS.includes(url.hostname.toLowerCase());
}
