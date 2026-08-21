import { createHash } from 'crypto';
import { Throttle } from '@nestjs/throttler';

/**
 * Rate limit cho `POST /auth/login` và `POST /auth/refresh`.
 *
 * Vì sao KHÔNG khoá theo IP:
 * cả một lớp học ngồi sau NAT của trường chỉ có 1 IP công cộng. 30 em vào học cùng lúc là
 * 30 lượt login/phút từ đúng một IP — khoá theo IP sẽ chặn oan cả lớp, còn kẻ dò mật khẩu
 * thì chỉ cần đổi IP. Nên:
 *   - login   -> khoá theo (IP, email): dò mật khẩu một tài khoản bị chặn sau N lần,
 *                các bạn cùng lớp dùng email khác nên không ảnh hưởng nhau.
 *   - refresh -> khoá theo chính refresh token (băm SHA-256): mối đe doạ ở đây là dò token,
 *                mà token thì mỗi người một cái.
 *
 * API đứng sau Caddy nên `req.ip` chỉ đúng khi Express bật `trust proxy` (xem main.ts).
 */

export const AUTH_RATE_TTL_MS = 60_000;
export const AUTH_RATE_LIMIT = 5;

/** Chặn thêm ~AUTH_BLOCK_MS sau khi vượt ngưỡng để dò mật khẩu không "nhỏ giọt" qua cửa. */
export const AUTH_BLOCK_MS = 5 * 60_000;

export const REFRESH_COOKIE_NAME = 'refresh_token';

type ThrottledRequest = {
  ip?: string;
  body?: unknown;
  cookies?: Record<string, unknown>;
};

function clientIp(req: ThrottledRequest): string {
  return req.ip ?? 'unknown-ip';
}

/** Băm token trước khi làm khoá — không để token thật nằm trong bộ nhớ rate limiter. */
function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function loginTracker(req: ThrottledRequest): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  // Không có email (body rác) -> ValidationPipe sẽ chặn, nhưng vẫn phải đếm theo IP để
  // không tạo một đường vòng vô hạn lượt.
  return email === '' ? `login:ip:${clientIp(req)}` : `login:${clientIp(req)}:${email}`;
}

export function refreshTracker(req: ThrottledRequest): string {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof token === 'string' && token !== ''
    ? `refresh:token:${fingerprint(token)}`
    : `refresh:ip:${clientIp(req)}`;
}

/** @Throttle đã cấu hình sẵn cho các endpoint xác thực. */
export const ThrottleAuth = (tracker: typeof loginTracker): MethodDecorator & ClassDecorator =>
  Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
      blockDuration: AUTH_BLOCK_MS,
      getTracker: (req) => tracker(req as ThrottledRequest),
    },
  });
