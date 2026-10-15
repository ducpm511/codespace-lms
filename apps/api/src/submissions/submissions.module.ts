import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { ScratchModule } from '../scratch/scratch.module';

@Module({
  imports: [ScratchModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
