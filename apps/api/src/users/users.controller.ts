import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { Paginated, UserDetail, UserLookupDto, UserSummary } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { LookupUserQueryDto } from './dto/lookup-user-query.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  list(@Query() q: PaginationQueryDto): Promise<Paginated<UserSummary>> {
    return this.users.list(q.page, q.pageSize);
  }

  /**
   * Tra người dùng theo email chính xác để thêm vào lớp.
   * Dùng `class.manage` (giáo viên có) thay vì `user.read` (chỉ admin) — trả DTO tối giản,
   * KHÔNG lộ role/status. Đặt TRƯỚC `:id` để không bị nuốt route.
   */
  @Get('lookup')
  @RequirePermission(PERMISSIONS.CLASS_MANAGE)
  lookup(@Query() q: LookupUserQueryDto): Promise<UserLookupDto> {
    return this.users.lookupByEmail(q.email);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_CREATE)
  create(@Body() dto: CreateUserDto): Promise<UserDetail> {
    return this.users.create(dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  findOne(@Param('id') id: string): Promise<UserDetail> {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDetail> {
    return this.users.update(id, dto);
  }

  @Post(':id/roles')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto): Promise<UserDetail> {
    return this.users.assignRole(id, dto.roleKey, dto.classId ?? null);
  }

  @Delete(':id/roles/:roleKey')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  revokeRole(
    @Param('id') id: string,
    @Param('roleKey') roleKey: string,
    @Query('classId') classId?: string,
  ): Promise<UserDetail> {
    return this.users.revokeRole(id, roleKey, classId ?? null);
  }
}
