import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: string; ts: string } {
    return { status: 'ok', service: 'lms-api', ts: new Date().toISOString() };
  }
}
