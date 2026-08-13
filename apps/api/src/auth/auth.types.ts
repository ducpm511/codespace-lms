import type { Request } from 'express';

/** Payload trong access JWT. */
export interface JwtPayload {
  sub: string; // userId
}

/** Principal đính vào request sau khi guard xác thực access token. */
export interface AuthPrincipal {
  userId: string;
}

/** Request đã qua JwtAuthGuard (có principal) + cookies (cookie-parser). */
export interface AuthenticatedRequest extends Request {
  user?: AuthPrincipal;
  cookies: Record<string, string>;
}

/** Metadata client cho refresh token (audit/thu hồi). */
export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}
