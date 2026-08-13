import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { AssignmentDetail, AssignmentSummary, Paginated } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';

@Controller('assignments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ASSIGNMENT_READ)
  list(@Query() q: ListAssignmentsQueryDto): Promise<Paginated<AssignmentSummary>> {
    return this.assignments.list(q.courseId, q.page, q.pageSize);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ASSIGNMENT_CREATE)
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthPrincipal): Promise<AssignmentDetail> {
    return this.assignments.create(dto, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ASSIGNMENT_READ)
  findOne(@Param('id') id: string): Promise<AssignmentDetail> {
    return this.assignments.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ASSIGNMENT_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto): Promise<AssignmentDetail> {
    return this.assignments.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.ASSIGNMENT_DELETE)
  remove(@Param('id') id: string): Promise<void> {
    return this.assignments.remove(id);
  }
}
