import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard
import { TeachController } from './teach.controller';
import { TeachService } from './teach.service';

@Module({
  imports: [AuthModule],
  controllers: [TeachController],
  providers: [TeachService],
})
export class TeachModule {}
