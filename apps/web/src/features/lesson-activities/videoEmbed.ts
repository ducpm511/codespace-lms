import { VIDEO_EMBED_HOSTS } from '@lms/contracts';

/**
 * Đổi link video người dùng dán sang URL nhúng được, CHỈ khi host nằm trong allowlist
 * (INVARIANT P7 — không nhúng iframe từ domain tùy ý). Trả `null` nếu không hợp lệ →
 * caller hiển thị link thường thay vì iframe.
 */
export function toEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  if (!VIDEO_EMBED_HOSTS.includes(host)) return null;

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.pathname.startsWith('/embed/')) return url.toString();
    const id = url.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'player.vimeo.com') {
    return url.toString();
  }
  if (host.endsWith('vimeo.com')) {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : null;
  }
  if (host === 'drive.google.com') {
    const parts = url.pathname.split('/').filter(Boolean); // file/d/<id>/view
    const idx = parts.indexOf('d');
    const id = idx >= 0 ? parts[idx + 1] : null;
    return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : null;
  }
  return null;
}
