import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // cung cấp JwtAuthGuard (JwtService global)
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
