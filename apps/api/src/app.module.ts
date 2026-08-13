import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { ClassesModule } from './classes/classes.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Nạp env: ưu tiên .env root monorepo, rồi .env cục bộ app. Biến shell (nếu có) vẫn thắng.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    PrismaModule,
    RbacModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    ClassesModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
