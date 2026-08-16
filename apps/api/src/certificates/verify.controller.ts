import { Controller, Get, Param } from '@nestjs/common';
import type { PublicVerificationDto } from '@lms/contracts';
import { CertificatesService } from './certificates.service';

/**
 * Public controller cho trang xác thực chứng chỉ (/verify/:code).
 * KHÔNG sử dụng JwtAuthGuard hay PermissionsGuard — bất kỳ ai có mã đều xem được.
 * Trả về thông tin xác thực tối thiểu, KHÔNG chứa PII nhạy cảm.
 */
@Controller('verify')
export class VerifyController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get(':code')
  verify(@Param('code') code: string): Promise<PublicVerificationDto> {
    return this.certificatesService.verify(code);
  }
}
