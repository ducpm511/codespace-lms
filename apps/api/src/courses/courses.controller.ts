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
  CourseDetail,
  CourseSummary,
  LessonActivityDto,
  LessonDetail,
  Paginated,
} from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateLessonActivityDto } from './dto/create-lesson-activity.dto';
import { UpdateLessonActivityDto } from './dto/update-lesson-activity.dto';
import { ReorderLessonActivitiesDto } from './dto/reorder-lesson-activities.dto';
import { LessonActivitiesService } from './lesson-activities.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly activities: LessonActivitiesService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.COURSE_READ)
  list(@Query() q: PaginationQueryDto): Promise<Paginated<CourseSummary>> {
    return this.courses.list(q.page, q.pageSize);
  }

  @Post()
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthPrincipal): Promise<CourseDetail> {
    return this.courses.create(dto, user.userId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.COURSE_READ)
  findOne(@Param('id') id: string): Promise<CourseDetail> {
    return this.courses.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto): Promise<CourseDetail> {
    return this.courses.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.COURSE_PUBLISH)
  publish(@Param('id') id: string): Promise<CourseDetail> {
    return this.courses.setStatus(id, 'published');
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.COURSE_PUBLISH)
  archive(@Param('id') id: string): Promise<CourseDetail> {
    return this.courses.setStatus(id, 'archived');
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.COURSE_DELETE)
  remove(@Param('id') id: string): Promise<void> {
    return this.courses.remove(id);
  }

  // --- Sections ---

  @Post(':id/sections')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  addSection(@Param('id') id: string, @Body() dto: CreateSectionDto): Promise<CourseDetail> {
    return this.courses.addSection(id, dto);
  }

  @Patch(':id/sections/:sectionId')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  updateSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSectionDto,
  ): Promise<CourseDetail> {
    return this.courses.updateSection(id, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  removeSection(@Param('id') id: string, @Param('sectionId') sectionId: string): Promise<CourseDetail> {
    return this.courses.removeSection(id, sectionId);
  }

  // --- Lessons ---

  @Post(':id/sections/:sectionId/lessons')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  addLesson(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateLessonDto,
  ): Promise<CourseDetail> {
    return this.courses.addLesson(id, sectionId, dto);
  }

  @Patch(':id/sections/:sectionId/lessons/:lessonId')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  updateLesson(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<CourseDetail> {
    return this.courses.updateLesson(id, sectionId, lessonId, dto);
  }

  @Delete(':id/sections/:sectionId/lessons/:lessonId')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  removeLesson(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<CourseDetail> {
    return this.courses.removeLesson(id, sectionId, lessonId);
  }

  // --- Lesson activities (P7) — IDOR kiểm trong service theo course/section/lesson trong path ---

  @Get(':id/sections/:sectionId/lessons/:lessonId')
  @RequirePermission(PERMISSIONS.COURSE_READ)
  lessonDetail(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonDetail> {
    return this.activities.getLessonDetail(id, sectionId, lessonId);
  }

  @Post(':id/sections/:sectionId/lessons/:lessonId/activities')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  addActivity(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateLessonActivityDto,
  ): Promise<LessonActivityDto[]> {
    return this.activities.create(id, sectionId, lessonId, dto);
  }

  @Put(':id/sections/:sectionId/lessons/:lessonId/activities/reorder')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  reorderActivities(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: ReorderLessonActivitiesDto,
  ): Promise<LessonActivityDto[]> {
    return this.activities.reorder(id, sectionId, lessonId, dto);
  }

  @Patch(':id/sections/:sectionId/lessons/:lessonId/activities/:activityId')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  updateActivity(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateLessonActivityDto,
  ): Promise<LessonActivityDto[]> {
    return this.activities.update(id, sectionId, lessonId, activityId, dto);
  }

  @Delete(':id/sections/:sectionId/lessons/:lessonId/activities/:activityId')
  @RequirePermission(PERMISSIONS.COURSE_UPDATE)
  removeActivity(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Param('lessonId') lessonId: string,
    @Param('activityId') activityId: string,
  ): Promise<LessonActivityDto[]> {
    return this.activities.remove(id, sectionId, lessonId, activityId);
  }
}
