import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard (JwtService global)
import { GamificationModule } from '../gamification/gamification.module';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { QuizAttemptsController } from './quiz-attempts.controller';

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [QuizController, QuizAttemptsController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
