import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type {
  AuthUser,
  LoginResponse,
  PasswordChangeResult,
  RefreshResponse,
} from '@lms/contracts';
import { AuthService } from './auth.service';
import {
  REFRESH_COOKIE_NAME,
  ThrottleAuth,
  bearerTracker,
  loginTracker,
  refreshTracker,
} from '../common/throttling/auth-throttle';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedRequest, AuthPrincipal, RequestMeta } from './auth.types';

const REFRESH_COOKIE = REFRESH_COOKIE_NAME;
const REFRESH_COOKIE_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @ThrottleAuth(loginTracker)
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { accessToken, refreshToken, refreshExpiresAt, user } = await this.auth.login(
      dto.email,
      dto.password,
      this.meta(req),
    );
    this.setRefreshCookie(res, refreshToken, refreshExpiresAt);
    return { accessToken, user };
  }

  @Post('refresh')
  @ThrottleAuth(refreshTracker)
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const { accessToken, refreshToken, refreshExpiresAt } = await this.auth.refresh(
      req.cookies?.[REFRESH_COOKIE],
      this.meta(req),
    );
    this.setRefreshCookie(res, refreshToken, refreshExpiresAt);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  }

  /**
   * Đổi mật khẩu tự phục vụ. Thu hồi hết refresh token nên client PHẢI đăng nhập lại sau đó —
   * cookie refresh hiện tại chết ngay, xoá luôn cho khỏi treo một cookie vô dụng.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  @ThrottleAuth(bearerTracker)
  async changePassword(
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PasswordChangeResult> {
    const result = await this.auth.changePassword(
      principal.userId,
      dto.currentPassword,
      dto.newPassword,
      this.meta(req),
    );
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() principal: AuthPrincipal): Promise<AuthUser> {
    return this.auth.buildAuthUser(principal.userId);
  }

  private meta(req: AuthenticatedRequest): RequestMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  /** Refresh token đặt trong cookie httpOnly, path hẹp /api/auth — không lộ ra JS (cx-hard-limits). */
  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }
}
