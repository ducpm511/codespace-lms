import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@lms/database';
import type { PermissionSummary, RoleSummary } from '@lms/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoleDto } from './dto/create-role.dto';

const roleInclude = { permissions: { include: { permission: true } } } satisfies Prisma.RoleInclude;
type RoleWithPerms = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

/** Quản lý role/permission (CRUD). Tách khỏi RbacService (chỉ lo giải quyền cho guard). */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({ orderBy: { key: 'asc' }, include: roleInclude });
    return roles.map(toRoleSummary);
  }

  async createRole(dto: CreateRoleDto): Promise<RoleSummary> {
    const existing = await this.prisma.role.findUnique({ where: { key: dto.key }, select: { id: true } });
    if (existing) {
      throw new ConflictException(`Role key đã tồn tại: ${dto.key}`);
    }
    const role = await this.prisma.role.create({
      data: { key: dto.key, name: dto.name, description: dto.description },
      include: roleInclude,
    });
    return toRoleSummary(role);
  }

  async listPermissions(): Promise<PermissionSummary[]> {
    const perms = await this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
    return perms.map((p) => ({ id: p.id, key: p.key, description: p.description }));
  }

  /** Gắn permission vào role (idempotent). */
  async attachPermission(roleId: string, permissionKey: string): Promise<RoleSummary> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) {
      throw new NotFoundException('Role không tồn tại');
    }
    const perm = await this.prisma.permission.findUnique({ where: { key: permissionKey }, select: { id: true } });
    if (!perm) {
      throw new NotFoundException(`Permission không tồn tại: ${permissionKey}`);
    }
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    });
    if (!existing) {
      await this.prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
    const full = await this.prisma.role.findUniqueOrThrow({ where: { id: roleId }, include: roleInclude });
    return toRoleSummary(full);
  }
}

function toRoleSummary(role: RoleWithPerms): RoleSummary {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map((rp) => rp.permission.key),
  };
}
