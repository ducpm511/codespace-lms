import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma } from '@lms/database';
import type { Paginated, UserDetail, UserSummary } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const userInclude = { roles: { include: { role: true } } } satisfies Prisma.UserInclude;
type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number): Promise<Paginated<UserSummary>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: userInclude,
      }),
      this.prisma.user.count(),
    ]);
    return { items: rows.map(toSummary), total, page, pageSize };
  }

  async create(dto: CreateUserDto): Promise<UserDetail> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }
    const roleIds = await this.resolveRoleIds(dto.roleKeys ?? []);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await hash(dto.password, 10),
        fullName: dto.fullName,
        status: dto.status ?? 'invited',
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      include: userInclude,
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

  async update(id: string, dto: UpdateUserDto): Promise<UserDetail> {
    await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { fullName: dto.fullName, status: dto.status, avatarUrl: dto.avatarUrl },
      include: userInclude,
    });
    return toDetail(user);
  }

  async assignRole(userId: string, roleKey: string, classId: string | null): Promise<UserDetail> {
    await this.ensureExists(userId);
    const role = await this.prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });
    if (!role) {
      throw new NotFoundException(`Role không tồn tại: ${roleKey}`);
    }
    // Idempotent: findFirst rồi create (không upsert được vì classId nullable trong unique — xem schema).
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id, classId },
    });
    if (!existing) {
      await this.prisma.userRole.create({ data: { userId, roleId: role.id, classId } });
    }
    return this.findOne(userId);
  }

  async revokeRole(userId: string, roleKey: string, classId: string | null): Promise<UserDetail> {
    await this.ensureExists(userId);
    const role = await this.prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });
    if (!role) {
      throw new NotFoundException(`Role không tồn tại: ${roleKey}`);
    }
    await this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id, classId } });
    return this.findOne(userId);
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
