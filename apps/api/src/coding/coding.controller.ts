import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type {
  CodingProblemAuthorDetail,
  CodingProblemStudentDetail,
  CodingProblemSummary,
  Paginated,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CodingService } from './coding.service';
import { CreateCodingProblemDto } from './dto/create-coding-problem.dto';
import { UpdateCodingProblemDto } from './dto/update-coding-problem.dto';
import { UpsertTestCaseDto } from './dto/upsert-test-case.dto';
import { ListCodingProblemsQueryDto } from './dto/list-coding-problems-query.dto';
import { AttemptQueryDto } from './dto/attempt-query.dto';

@Controller('coding-problems')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CodingController {
  constructor(private readonly coding: CodingService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CODING_READ)
  list(@Query() q: ListCodingProblemsQueryDto): Promise<Paginated<CodingProblemSummary>> {
    return this.coding.list(q.courseId, q.page, q.pageSize);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CODING_CREATE)
  create(
    @Body() dto: CreateCodingProblemDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<CodingProblemAuthorDetail> {
    return this.coding.create(dto, user.userId);
  }

  // Đề cho học viên làm bài (chỉ sample test). Đặt TRƯỚC ':id' để không bị nuốt route.
  @Get(':id/attempt')
  attempt(
    @Param('id') id: string,
    @Query() q: AttemptQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<CodingProblemStudentDetail> {
    return this.coding.getStudentDetail(id, q.classId, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CODING_READ)
  findOne(@Param('id') id: string): Promise<CodingProblemAuthorDetail> {
    return this.coding.getAuthorDetail(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.CODING_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateCodingProblemDto): Promise<CodingProblemAuthorDetail> {
    return this.coding.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.CODING_DELETE)
  remove(@Param('id') id: string): Promise<void> {
    return this.coding.remove(id);
  }

  @Put(':id/test-cases')
  @RequirePermission(PERMISSIONS.CODING_UPDATE)
  upsertTestCase(@Param('id') id: string, @Body() dto: UpsertTestCaseDto): Promise<CodingProblemAuthorDetail> {
    return this.coding.upsertTestCase(id, dto);
  }

  @Delete(':id/test-cases/:testCaseId')
  @RequirePermission(PERMISSIONS.CODING_UPDATE)
  removeTestCase(
    @Param('id') id: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<CodingProblemAuthorDetail> {
    return this.coding.removeTestCase(id, testCaseId);
  }
}
