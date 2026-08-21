import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type {
  Paginated,
  PasswordChangeResult,
  UserDetail,
  UserLookupDto,
  UserSummary,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal, AuthenticatedRequest } from '../auth/auth.types';
import type { AuditActor } from '../common/audit-actor';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LookupUserQueryDto } from './dto/lookup-user-query.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  list(@Query() q: ListUsersQueryDto): Promise<Paginated<UserSummary>> {
    return this.users.list(q);
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
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() principal: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserDetail> {
    return this.users.create(dto, actorOf(principal, req));
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  findOne(@Param('id') id: string): Promise<UserDetail> {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() principal: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserDetail> {
    return this.users.update(id, dto, actorOf(principal, req));
  }

  /**
   * Admin đặt lại mật khẩu cho người khác. Chưa có email provider nên chưa làm quên-mật-khẩu;
   * đây là đường duy nhất để cứu một tài khoản mất mật khẩu trong pilot.
   * Mật khẩu mới KHÔNG bao giờ được trả về hay ghi log — admin đọc từ form và tự chuyển cho học viên.
   */
  @Post(':id/reset-password')
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  @HttpCode(200)
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() principal: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<PasswordChangeResult> {
    return this.users.resetPassword(id, dto.newPassword, actorOf(principal, req));
  }

  @Post(':id/roles')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() principal: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserDetail> {
    return this.users.assignRole(id, dto.roleKey, dto.classId ?? null, actorOf(principal, req));
  }

  @Delete(':id/roles/:roleKey')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  revokeRole(
    @Param('id') id: string,
    @Param('roleKey') roleKey: string,
    @CurrentUser() principal: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
    @Query('classId') classId?: string,
  ): Promise<UserDetail> {
    return this.users.revokeRole(id, roleKey, classId ?? null, actorOf(principal, req));
  }
}

function actorOf(principal: AuthPrincipal, req: AuthenticatedRequest): AuditActor {
  return { userId: principal.userId, ip: req.ip };
}
