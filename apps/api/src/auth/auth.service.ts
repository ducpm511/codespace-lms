import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import type { AuthUser, PasswordChangeResult } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestMeta } from './auth.types';

/** Kết quả issue token nội bộ (raw refresh chỉ ra tới controller để set cookie, không lưu thô). */
interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Đăng nhập bằng email + mật khẩu. Sai thông tin → 401 (message chung, không lộ user tồn tại hay không). */
  async login(email: string, password: string, meta: RequestMeta): Promise<IssuedTokens & { user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const invalid = new UnauthorizedException('Email hoặc mật khẩu không đúng');
    if (!user || user.status === 'suspended') {
      throw invalid;
    }
    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      throw invalid;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokens(user.id, meta);
    const authUser = await this.buildAuthUser(user.id);
    return { ...tokens, user: authUser };
  }

  /** Xoay vòng refresh token: thu hồi cái cũ, cấp cặp mới. Token sai/hết hạn/đã thu hồi → 401. */
  async refresh(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<IssuedTokens> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Thiếu refresh token');
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    // Thu hồi cũ + tạo mới trong CÙNG transaction (không để lộ khoảng trống).
    const raw = this.randomToken();
    const newHash = this.hashToken(raw);
    const refreshExpiresAt = this.refreshExpiry();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.create({
        data: {
          userId: record.userId,
          tokenHash: newHash,
          expiresAt: refreshExpiresAt,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
    ]);

    const accessToken = await this.signAccessToken(record.userId);
    return { accessToken, refreshToken: raw, refreshExpiresAt };
  }

  /** Đăng xuất: thu hồi refresh token hiện tại (idempotent — gọi lại vô hại). */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Đổi mật khẩu tự phục vụ. Phải nhập đúng mật khẩu hiện tại — nếu không, ai mượn được
   * máy đang đăng nhập là chiếm luôn tài khoản.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<PasswordChangeResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    const ok = await compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    return this.setPassword({
      userId,
      newPassword,
      actorId: userId,
      action: 'user.password_change',
      ip: meta.ip,
    });
  }

  /**
   * Đặt mật khẩu mới + thu hồi TOÀN BỘ refresh token + ghi audit, trong CÙNG một transaction
   * (INVARIANT #6). Thu hồi hết là cố ý: đổi mật khẩu vì nghi bị lộ mà phiên cũ vẫn sống thì
   * việc đổi trở nên vô nghĩa — kể cả thiết bị đang thao tác cũng phải đăng nhập lại.
   *
   * Dùng chung cho tự đổi (AuthService) và admin đặt lại (UsersService).
   */
  async setPassword(params: {
    userId: string;
    newPassword: string;
    actorId: string;
    action: 'user.password_change' | 'user.password_reset';
    ip?: string;
  }): Promise<PasswordChangeResult> {
    const passwordHash = await hash(params.newPassword, PASSWORD_HASH_ROUNDS);
    const now = new Date();

    const [, revoked] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: params.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          entity: 'User',
          entityId: params.userId,
          // KHÔNG ghi mật khẩu (kể cả hash) vào audit — INVARIANT #5.
          metaJson: { selfService: params.actorId === params.userId },
          ip: params.ip,
        },
      }),
    ]);

    return { revokedSessions: revoked.count };
  }

  /** Dựng AuthUser: gộp roles + permission keys (khử trùng) từ RBAC. */
  async buildAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const roles = user.roles.map((ur) => ur.role.key);
    const permissions = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key);
      }
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles,
      permissions: [...permissions],
    };
  }

  // --- helpers ---

  private async issueTokens(userId: string, meta: RequestMeta): Promise<IssuedTokens> {
    const accessToken = await this.signAccessToken(userId);
    const raw = this.randomToken();
    const refreshExpiresAt = this.refreshExpiry();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });
    return { accessToken, refreshToken: raw, refreshExpiresAt };
  }

  private signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      },
    );
  }

  /** Refresh token là chuỗi ngẫu nhiên entropy cao; lưu SHA-256 (tra cứu được), không lưu bản thô. */
  private randomToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshExpiry(): Date {
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    return new Date(Date.now() + parseDurationMs(ttl));
  }
}

/** Chi phí bcrypt — khớp với UsersService.create để hash cũ/mới cùng độ mạnh. */
export const PASSWORD_HASH_ROUNDS = 10;

/** Parse '15m' | '2h' | '30d' | '3600s' → milliseconds. */
export function parseDurationMs(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) {
    throw new Error(`TTL không hợp lệ: ${ttl}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const factors: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * factors[unit];
}
