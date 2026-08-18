import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard (JwtService global)
import { GamificationModule } from '../gamification/gamification.module';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
