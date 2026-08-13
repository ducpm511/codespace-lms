import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard cho RbacController
import { RbacService } from './rbac.service';
import { RolesService } from './roles.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacController } from './rbac.controller';

// @Global: mọi module dùng được PermissionsGuard/RbacService mà không cần import lại.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [RbacService, RolesService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
