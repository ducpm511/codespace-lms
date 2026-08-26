import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type {
  ClassDetail,
  ClassLeaderboardDto,
  ClassSummary,
  LessonGateDto,
  LessonProgressDto,
  MyLessonDto,
  Paginated,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AssignCourseDto } from './dto/assign-course.dto';
import { EnrollMemberDto } from './dto/enroll-member.dto';
import { SetLessonGateDto } from './dto/set-lesson-gate.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

// Param scope là ':classId' → PermissionsGuard trích classId để chấm quyền theo phạm vi lớp.
@Controller('classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CLASS_READ)
  list(@Query() q: PaginationQueryDto): Promise<Paginated<ClassSummary>> {
    return this.classes.list(q.page, q.pageSize);
  }

  // Lớp mình phụ trách/đang học — chỉ cần đăng nhập (lọc theo membership trong service).
  @Get('mine')
  listMine(@CurrentUser() user: AuthPrincipal): Promise<ClassSummary[]> {
    return this.classes.listMine(user.userId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CLASS_CREATE)
  create(@Body() dto: CreateClassDto, @CurrentUser() user: AuthPrincipal): Promise<ClassDetail> {
    return this.classes.create(dto, user.userId);
  }

  @Get(':classId')
  @RequirePermission(PERMISSIONS.CLASS_READ)
  findOne(@Param('classId') classId: string): Promise<ClassDetail> {
    return this.classes.findOne(classId);
  }

  @Get(':classId/report')
  @RequirePermission(PERMISSIONS.CLASS_READ)
  getReport(@Param('classId') classId: string) {
    return this.classes.getClassReport(classId);
  }

  // Bảng xếp hạng tuần của lớp — học viên PHẢI xem được nên KHÔNG gắn @RequirePermission
  // (`class.read` là quyền của GV/admin). Quyền xem kiểm theo membership trong service.
  @Get(':classId/leaderboard')
  getLeaderboard(
    @Param('classId') classId: string,
    @Query() q: LeaderboardQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ClassLeaderboardDto> {
    return this.classes.getLeaderboard(classId, user.userId, q.week);
  }

  @Patch(':classId')
  @RequirePermission(PERMISSIONS.CLASS_UPDATE)
  update(@Param('classId') classId: string, @Body() dto: UpdateClassDto): Promise<ClassDetail> {
    return this.classes.update(classId, dto);
  }

  @Delete(':classId')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.CLASS_DELETE)
  remove(@Param('classId') classId: string): Promise<void> {
    return this.classes.remove(classId);
  }

  // --- Gán khóa học ---

  @Post(':classId/courses')
  @RequirePermission(PERMISSIONS.CLASS_MANAGE)
  assignCourse(@Param('classId') classId: string, @Body() dto: AssignCourseDto): Promise<ClassDetail> {
    return this.classes.assignCourse(classId, dto);
  }

  @Delete(':classId/courses/:courseId')
  @RequirePermission(PERMISSIONS.CLASS_MANAGE)
  removeCourse(
    @Param('classId') classId: string,
    @Param('courseId') courseId: string,
  ): Promise<ClassDetail> {
    return this.classes.removeCourse(classId, courseId);
  }

  // --- Thành viên ---

  @Post(':classId/members')
  @RequirePermission(PERMISSIONS.CLASS_MANAGE)
  enrollMember(@Param('classId') classId: string, @Body() dto: EnrollMemberDto): Promise<ClassDetail> {
    return this.classes.enrollMember(classId, dto);
  }

  @Delete(':classId/members/:userId')
  @RequirePermission(PERMISSIONS.CLASS_MANAGE)
  removeMember(
    @Param('classId') classId: string,
    @Param('userId') userId: string,
  ): Promise<ClassDetail> {
    return this.classes.removeMember(classId, userId);
  }

  // --- Lesson gate ---

  @Get(':classId/gates')
  @RequirePermission(PERMISSIONS.CLASS_READ)
  listGates(@Param('classId') classId: string): Promise<LessonGateDto[]> {
    return this.classes.listGates(classId);
  }

  @Put(':classId/gates')
  @RequirePermission(PERMISSIONS.CLASS_MANAGE)
  setGate(
    @Param('classId') classId: string,
    @Body() dto: SetLessonGateDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<LessonGateDto> {
    return this.classes.setGate(classId, dto, user.userId);
  }

  // --- Tiến độ học viên (chỉ đăng nhập + membership; không dùng permission key) ---

  @Get(':classId/my-progress')
  getMyProgress(
    @Param('classId') classId: string,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<LessonProgressDto[]> {
    return this.classes.getMyProgress(classId, user.userId);
  }

  // Bài học viên được phép học (chỉ bài đã mở gate) + tiến độ. Chỉ auth + membership.
  @Get(':classId/my-lessons')
  getMyLessons(
    @Param('classId') classId: string,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<MyLessonDto[]> {
    return this.classes.getMyLessons(classId, user.userId);
  }

  @Put(':classId/lessons/:lessonId/progress')
  updateMyProgress(
    @Param('classId') classId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<LessonProgressDto> {
    return this.classes.updateMyProgress(classId, lessonId, user.userId, dto);
  }
}
