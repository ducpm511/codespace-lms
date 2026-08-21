import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

type CapturedResponse = { status: number; body: Record<string, unknown> };

function runFilter(exception: unknown, isProduction: boolean): CapturedResponse {
  const captured: CapturedResponse = { status: 0, body: {} };
  const res = {
    status: (code: number) => {
      captured.status = code;
      return { json: (body: Record<string, unknown>) => (captured.body = body) };
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'GET', url: '/api/courses/42' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter(isProduction).catch(exception, host);
  return captured;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('lỗi 4xx — giữ nguyên message cho FE', () => {
    it('ForbiddenException giữ status và message', () => {
      const out = runFilter(new ForbiddenException('Không có quyền'), true);
      expect(out.status).toBe(HttpStatus.FORBIDDEN);
      expect(out.body.message).toBe('Không có quyền');
    });

    it('mảng message của ValidationPipe được giữ nguyên', () => {
      const out = runFilter(
        new BadRequestException({
          statusCode: 400,
          message: ['email must be an email', 'password should not be empty'],
          error: 'Bad Request',
        }),
        true,
      );
      expect(out.status).toBe(HttpStatus.BAD_REQUEST);
      expect(out.body.message).toEqual([
        'email must be an email',
        'password should not be empty',
      ]);
    });

    it('kèm path và timestamp', () => {
      const out = runFilter(new ForbiddenException(), false);
      expect(out.body.path).toBe('/api/courses/42');
      expect(typeof out.body.timestamp).toBe('string');
    });
  });

  describe('lỗi 5xx — INVARIANT #7: không lộ nội bộ ở production', () => {
    it('lỗi lạ ở production chỉ trả message chung', () => {
      const out = runFilter(new Error('connect ECONNREFUSED 10.0.0.5:5432'), true);
      expect(out.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(out.body.message).toBe('Internal server error');
      expect(JSON.stringify(out.body)).not.toContain('ECONNREFUSED');
    });

    it('không bao giờ trả stack trace', () => {
      const out = runFilter(new Error('boom'), true);
      expect(out.body).not.toHaveProperty('stack');
    });

    it('HttpException 500 tự tạo cũng bị che ở production', () => {
      const out = runFilter(
        new HttpException('table users_secret missing', HttpStatus.INTERNAL_SERVER_ERROR),
        true,
      );
      expect(out.body.message).toBe('Internal server error');
    });

    it('ở dev vẫn trả message thật để debug', () => {
      const out = runFilter(new Error('connect ECONNREFUSED'), false);
      expect(out.body.message).toBe('connect ECONNREFUSED');
    });

    it('ghi log đầy đủ ở server dù client chỉ nhận message chung', () => {
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      runFilter(new Error('boom'), true);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/courses/42 -> 500'),
        expect.stringContaining('boom'),
      );
    });

    it('giá trị throw không phải Error vẫn ra 500 chung', () => {
      const out = runFilter('chuỗi lỗi thô', true);
      expect(out.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(out.body.message).toBe('Internal server error');
    });
  });
});
