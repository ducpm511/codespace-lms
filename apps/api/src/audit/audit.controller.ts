import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findLogs(query);
  }
}
