import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerGuard, ThrottlerStorageService } from '@nestjs/throttler';
import { AuthController } from '../../auth/auth.controller';
import {
  AUTH_RATE_LIMIT,
  REFRESH_COOKIE_NAME,
  loginTracker,
  refreshTracker,
} from './auth-throttle';

describe('auth throttling', () => {
  describe('loginTracker', () => {
    it('khoá theo (IP, email) — hai bạn cùng lớp sau một NAT không chặn nhau', () => {
      const ip = '203.0.113.9';
      expect(loginTracker({ ip, body: { email: 'an@lop.vn' } })).not.toBe(
        loginTracker({ ip, body: { email: 'binh@lop.vn' } }),
      );
    });

    it('cùng email cùng IP thì chung một khoá', () => {
      const req = { ip: '203.0.113.9', body: { email: 'an@lop.vn' } };
      expect(loginTracker(req)).toBe(loginTracker({ ...req }));
    });

    it('email không phân biệt hoa thường và khoảng trắng thừa', () => {
      expect(loginTracker({ ip: '1.2.3.4', body: { email: '  An@Lop.VN ' } })).toBe(
        loginTracker({ ip: '1.2.3.4', body: { email: 'an@lop.vn' } }),
      );
    });

    it('body không có email thì rơi về khoá theo IP, không bỏ đếm', () => {
      expect(loginTracker({ ip: '1.2.3.4', body: {} })).toBe('login:ip:1.2.3.4');
      expect(loginTracker({ ip: '1.2.3.4' })).toBe('login:ip:1.2.3.4');
    });
  });

  describe('refreshTracker', () => {
    it('khoá theo token, không theo IP — cả lớp refresh cùng lúc vẫn qua', () => {
      const ip = '203.0.113.9';
      expect(refreshTracker({ ip, cookies: { [REFRESH_COOKIE_NAME]: 'token-cua-an' } })).not.toBe(
        refreshTracker({ ip, cookies: { [REFRESH_COOKIE_NAME]: 'token-cua-binh' } }),
      );
    });

    it('không để token thật lọt vào khoá rate limit', () => {
      const key = refreshTracker({ ip: '1.2.3.4', cookies: { [REFRESH_COOKIE_NAME]: 'secret-token' } });
      expect(key).not.toContain('secret-token');
      expect(key).toMatch(/^refresh:token:[0-9a-f]{32}$/);
    });

    it('không có cookie thì đếm theo IP', () => {
      expect(refreshTracker({ ip: '1.2.3.4', cookies: {} })).toBe('refresh:ip:1.2.3.4');
    });
  });

  /**
   * Chạy ThrottlerGuard thật với metadata @ThrottleAuth đã gắn trên AuthController,
   * để khẳng định ngưỡng thực sự có hiệu lực chứ không chỉ là decorator trang trí.
   */
  describe('ThrottlerGuard trên POST /auth/login', () => {
    let storage: ThrottlerStorageService;
    let guard: ThrottlerGuard;

    const contextFor = (req: Record<string, unknown>): ExecutionContext =>
      ({
        getHandler: () => AuthController.prototype.login,
        getClass: () => AuthController,
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => ({ header: () => undefined }),
        }),
      }) as unknown as ExecutionContext;

    const attempt = (email: string, ip = '203.0.113.9'): Promise<boolean> =>
      guard.canActivate(contextFor({ ip, body: { email } }));

    beforeEach(async () => {
      storage = new ThrottlerStorageService();
      guard = new ThrottlerGuard(
        [{ name: 'default', ttl: 60_000, limit: 600 }],
        storage,
        new Reflector(),
      );
      await guard.onModuleInit();
    });

    afterEach(() => storage.onApplicationShutdown());

    it(`cho qua đúng ${AUTH_RATE_LIMIT} lần rồi chặn`, async () => {
      for (let i = 0; i < AUTH_RATE_LIMIT; i++) {
        await expect(attempt('an@lop.vn')).resolves.toBe(true);
      }
      await expect(attempt('an@lop.vn')).rejects.toBeInstanceOf(ThrottlerException);
    });

    it('tài khoản khác trên cùng IP KHÔNG bị chặn lây', async () => {
      for (let i = 0; i < AUTH_RATE_LIMIT + 3; i++) {
        await attempt('an@lop.vn').catch(() => undefined);
      }
      await expect(attempt('binh@lop.vn')).resolves.toBe(true);
    });

    it('cùng tài khoản từ IP khác vẫn bị đếm riêng (chặn dò từ 1 máy)', async () => {
      for (let i = 0; i < AUTH_RATE_LIMIT; i++) {
        await attempt('an@lop.vn', '198.51.100.1');
      }
      await expect(attempt('an@lop.vn', '198.51.100.1')).rejects.toBeInstanceOf(ThrottlerException);
      await expect(attempt('an@lop.vn', '198.51.100.2')).resolves.toBe(true);
    });
  });
});
