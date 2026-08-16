import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { VerifyController } from './verify.controller';
import { CertificatesService } from './certificates.service';
import { GradingModule } from '../grading/grading.module';

@Module({
  imports: [GradingModule],
  controllers: [CertificatesController, VerifyController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
