import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('trả về status ok', () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('lms-api');
  });
});
