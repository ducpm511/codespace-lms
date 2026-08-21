import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// Health check bị uptime monitor gọi liên tục -> không tính vào rate limit.
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: string; ts: string } {
    return { status: 'ok', service: 'lms-api', ts: new Date().toISOString() };
  }
}
