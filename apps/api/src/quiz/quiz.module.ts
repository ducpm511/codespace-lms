import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard (JwtService global)
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';

@Module({
  imports: [AuthModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
