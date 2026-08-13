import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { PermissionSummary, RoleSummary } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AttachPermissionDto } from './dto/attach-permission.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @RequirePermission(PERMISSIONS.ROLE_READ)
  listRoles(): Promise<RoleSummary[]> {
    return this.roles.listRoles();
  }

  @Post('roles')
  @RequirePermission(PERMISSIONS.ROLE_CREATE)
  createRole(@Body() dto: CreateRoleDto): Promise<RoleSummary> {
    return this.roles.createRole(dto);
  }

  @Post('roles/:roleId/permissions')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  attachPermission(@Param('roleId') roleId: string, @Body() dto: AttachPermissionDto): Promise<RoleSummary> {
    return this.roles.attachPermission(roleId, dto.permissionKey);
  }

  @Get('permissions')
  @RequirePermission(PERMISSIONS.PERMISSION_READ)
  listPermissions(): Promise<PermissionSummary[]> {
    return this.roles.listPermissions();
  }
}
