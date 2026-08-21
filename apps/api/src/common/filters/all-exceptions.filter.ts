import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Body lỗi trả về client. Không bao giờ chứa stack hay chi tiết nội bộ. */
export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}

const GENERIC_MESSAGE = 'Internal server error';

/**
 * Chuẩn hoá mọi lỗi ra HTTP (INVARIANT #7: production không lộ stack trace / nội bộ).
 *
 * - Lỗi 4xx (HttpException): giữ nguyên message — FE dựa vào đó để hiện lỗi validate/quyền.
 * - Lỗi 5xx và lỗi không phải HttpException: client chỉ nhận message chung; chi tiết + stack
 *   ghi vào log server. Ở dev vẫn trả chi tiết để debug nhanh.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (isServerError) {
      // Log đầy đủ ở server; PII không nằm trong URL nên path an toàn để ghi (INVARIANT #5).
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(this.buildBody(exception, status, isServerError, req.url));
  }

  private buildBody(
    exception: unknown,
    status: number,
    isServerError: boolean,
    path: string,
  ): ErrorResponseBody {
    const base = { statusCode: status, timestamp: new Date().toISOString(), path };

    if (isServerError) {
      const message =
        this.isProduction || !(exception instanceof Error) ? GENERIC_MESSAGE : exception.message;
      return { ...base, message, error: GENERIC_MESSAGE };
    }

    // 4xx: giữ nguyên payload của HttpException (mảng message của ValidationPipe, v.v.).
    const payload = (exception as HttpException).getResponse();
    if (typeof payload === 'string') return { ...base, message: payload };

    const record = payload as { message?: string | string[]; error?: string };
    return {
      ...base,
      message: record.message ?? (exception as HttpException).message,
      error: record.error,
    };
  }
}
