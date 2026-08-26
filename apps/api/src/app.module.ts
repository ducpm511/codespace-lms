import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { ClassesModule } from './classes/classes.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { CodingModule } from './coding/coding.module';
import { QuizModule } from './quiz/quiz.module';
import { GradingModule } from './grading/grading.module';
import { CertificatesModule } from './certificates/certificates.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GamificationModule } from './gamification/gamification.module';
import { AuditModule } from './audit/audit.module';
import { CommentsModule } from './comments/comments.module';
import { FilesModule } from './files/files.module';
import { TeachModule } from './teach/teach.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthController } from './health/health.controller';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // Nạp env: ưu tiên .env root monorepo, rồi .env cục bộ app. Biến shell (nếu có) vẫn thắng.
    // `validate` chạy lúc boot: env thiếu/sai -> throw -> API chết ngay (xem env.validation.ts).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    // Trần chung cho mọi route, chỉ để chặn quét/scrape. Ngưỡng siết riêng cho /auth/login và
    // /auth/refresh nằm ở auth.controller.ts (xem common/throttling/auth-throttle.ts).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: 60_000,
          limit: Number(config.get<string>('RATE_LIMIT_PER_MINUTE') ?? 600),
        },
      ],
    }),
    StorageModule,
    PrismaModule,
    RbacModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    ClassesModule,
    AssignmentsModule,
    SubmissionsModule,
    CodingModule,
    QuizModule,
    GradingModule,
    CertificatesModule,
    NotificationsModule,
    GamificationModule,
    AuditModule,
    CommentsModule,
    FilesModule,
    TeachModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
