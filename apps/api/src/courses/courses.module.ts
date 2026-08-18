import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard (JwtService global)
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { LessonActivitiesService } from './lesson-activities.service';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService, LessonActivitiesService],
  exports: [CoursesService, LessonActivitiesService],
})
export class CoursesModule {}
