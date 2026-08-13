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
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@lms/contracts';
import type { CourseDetail, CourseSummary, Paginated } from '@lms/contracts';
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

@Controller('courses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

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
}
