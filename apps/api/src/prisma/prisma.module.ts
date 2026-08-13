import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global: mọi module inject được PrismaService mà không cần import lại. Xem sk-nestjs-module-pattern.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
