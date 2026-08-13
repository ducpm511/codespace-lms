import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Secret truyền theo từng lần sign/verify (access vs refresh khác secret) → JwtModule không đặt secret chung.
// global:true → JwtService dùng được ở guard của mọi module (JwtAuthGuard tái sử dụng).
@Module({
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
