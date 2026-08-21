import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma } from '@lms/database';
import type {
  Paginated,
  PasswordChangeResult,
  UserDetail,
  UserLookupDto,
  UserSummary,
} from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, PASSWORD_HASH_ROUNDS } from '../auth/auth.service';
import type { AuditActor } from '../common/audit-actor';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const userInclude = { roles: { include: { role: true } } } satisfies Prisma.UserInclude;
type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Danh sách người dùng có tìm kiếm + lọc Ở SERVER. `total` phải tính trên CÙNG bộ lọc,
   * nếu không thanh phân trang sẽ hiện số trang không tồn tại.
   */
  async list(query: ListUsersQueryDto): Promise<Paginated<UserSummary>> {
    const { page, pageSize } = query;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.roleKey) {
      where.roles = { some: { role: { key: query.roleKey } } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: userInclude,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  /**
   * Tra người dùng theo email CHÍNH XÁC (dùng khi thêm học viên vào lớp).
   * Cố ý KHÔNG cho tìm gần đúng/tiền tố: chỉ khớp tuyệt đối để hạn chế dò danh sách user
   * (surface này mở cho giáo viên có `class.manage`, rộng hơn `user.read`).
   * Email chuẩn hóa lowercase + trim để khớp với dữ liệu lưu.
   */
  async lookupByEmail(email: string): Promise<UserLookupDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng với email này');
    }
    return user;
  }

  async create(dto: CreateUserDto, actor: AuditActor): Promise<UserDetail> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }
    const roleIds = await this.resolveRoleIds(dto.roleKeys ?? []);
    const passwordHash = await hash(dto.password, PASSWORD_HASH_ROUNDS);

    // Transaction interactive vì entityId của audit chính là id user vừa tạo.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          status: dto.status ?? 'invited',
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include: userInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'user.create',
          entity: 'User',
          entityId: created.id,
          // Không ghi email/mật khẩu vào meta — entityId đủ để tra ngược (INVARIANT #5).
          metaJson: { status: created.status, roleKeys: dto.roleKeys ?? [] },
          ip: actor.ip,
        },
      });
      return created;
    });
    return toDetail(user);
  }

  async findOne(id: string): Promise<UserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return toDetail(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuditActor): Promise<UserDetail> {
    const before = await this.prisma.user.findUnique({ where: { id }, select: { status: true } });
    if (!before) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { fullName: dto.fullName, status: dto.status, avatarUrl: dto.avatarUrl },
        include: userInclude,
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.userId,
          action: 'user.update',
          entity: 'User',
          entityId: id,
          // Khoá/mở tài khoản là việc phải truy ngược được -> ghi cả trạng thái trước lẫn sau.
          metaJson: {
            statusFrom: before.status,
            statusTo: dto.status ?? before.status,
            fullNameChanged: dto.fullName !== undefined,
          },
          ip: actor.ip,
        },
      }),
    ]);
    return toDetail(user);
  }

  /**
   * Admin đặt lại mật khẩu cho người khác (quên mật khẩu chưa có vì chưa có email provider).
   * Thu hồi hết phiên + ghi audit trong cùng transaction — xem AuthService.setPassword.
   */
  async resetPassword(
    targetUserId: string,
    newPassword: string,
    actor: AuditActor,
  ): Promise<PasswordChangeResult> {
    await this.ensureExists(targetUserId);
    return this.auth.setPassword({
      userId: targetUserId,
      newPassword,
      actorId: actor.userId,
      action: 'user.password_reset',
      ip: actor.ip,
    });
  }

  async assignRole(
    userId: string,
    roleKey: string,
    classId: string | null,
    actor: AuditActor,
  ): Promise<UserDetail> {
    await this.ensureExists(userId);
    const role = await this.resolveRole(roleKey);
    // Idempotent: findFirst rồi create (không upsert được vì classId nullable trong unique — xem schema).
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id, classId },
    });
    // Đã có sẵn thì không ghi audit — gọi lại lần hai không phải là một thay đổi quyền.
    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.userRole.create({ data: { userId, roleId: role.id, classId } }),
        this.auditRoleChange('role.assign', userId, roleKey, classId, actor),
      ]);
    }
    return this.findOne(userId);
  }

  async revokeRole(
    userId: string,
    roleKey: string,
    classId: string | null,
    actor: AuditActor,
  ): Promise<UserDetail> {
    await this.ensureExists(userId);
    const role = await this.resolveRole(roleKey);
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id, classId },
    });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id, classId } }),
        this.auditRoleChange('role.revoke', userId, roleKey, classId, actor),
      ]);
    }
    return this.findOne(userId);
  }

  private async resolveRole(roleKey: string): Promise<{ id: string }> {
    const role = await this.prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });
    if (!role) {
      throw new NotFoundException(`Role không tồn tại: ${roleKey}`);
    }
    return role;
  }

  /** Đổi quyền phải truy ngược được: ai gán/gỡ role gì, cho ai, ở lớp nào (INVARIANT #6). */
  private auditRoleChange(
    action: 'role.assign' | 'role.revoke',
    userId: string,
    roleKey: string,
    classId: string | null,
    actor: AuditActor,
  ): Prisma.PrismaPromise<unknown> {
    return this.prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        action,
        entity: 'User',
        entityId: userId,
        metaJson: { roleKey, classId },
        ip: actor.ip,
      },
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
  }

  private async resolveRoleIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) {
      return [];
    }
    const roles = await this.prisma.role.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
    if (roles.length !== keys.length) {
      const found = new Set(roles.map((r) => r.key));
      const missing = keys.filter((k) => !found.has(k));
      throw new BadRequestException(`Role không tồn tại: ${missing.join(', ')}`);
    }
    return roles.map((r) => r.id);
  }
}

// --- mappers (chỉ field cần cho client — KHÔNG lộ passwordHash) ---

function toSummary(user: UserWithRoles): UserSummary {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    roles: user.roles.map((ur) => ur.role.key),
    createdAt: user.createdAt.toISOString(),
  };
}

function toDetail(user: UserWithRoles): UserDetail {
  return {
    ...toSummary(user),
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}
