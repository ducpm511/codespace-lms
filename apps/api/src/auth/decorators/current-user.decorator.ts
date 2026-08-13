import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthPrincipal } from '../auth.types';

/** Lấy principal đã xác thực từ request (đặt bởi JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      // Không bao giờ xảy ra nếu route có JwtAuthGuard — phòng thủ.
      throw new Error('CurrentUser dùng trên route chưa gắn JwtAuthGuard');
    }
    return req.user;
  },
);
