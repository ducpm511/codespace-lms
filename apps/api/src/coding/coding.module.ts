import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard (JwtService global)
import { CodingService } from './coding.service';
import { CodingController } from './coding.controller';
import { CodingSubmissionsController } from './coding-submissions.controller';
import { CodingQueueModule } from './queue/coding-queue.module';

@Module({
  imports: [AuthModule, CodingQueueModule.register()],
  controllers: [CodingController, CodingSubmissionsController],
  providers: [CodingService],
  exports: [CodingService],
})
export class CodingModule {}
