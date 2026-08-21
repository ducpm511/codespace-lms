import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  // Production chạy sau Caddy (reverse proxy) => IP thật nằm ở X-Forwarded-For. Không bật cờ này
  // thì mọi request đều mang IP của Caddy và rate limit sẽ đếm gộp cả lớp vào một khoá.
  // Chỉ tin đúng 1 hop: Caddy. Ở dev không có proxy nên để nguyên.
  if (isProduction) app.set('trust proxy', 1);

  app.use(cookieParser());
  // CSP mặc định của helmet chặn worker/wasm mà Monaco + Pyodide cần, nhưng API chỉ trả JSON —
  // trang tĩnh do Caddy phục vụ, không đi qua đây. Vẫn tắt CSP ở tầng API cho khỏi hiểu nhầm.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  // Validate input ở biên bằng allowlist (chống mass assignment). Xem sk-dto-validation.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // INVARIANT #7: production không trả stack trace ra client.
  app.useGlobalFilters(new AllExceptionsFilter(isProduction));

  // Production: web và API cùng origin qua Caddy nên CORS không cần thiết; giữ cấu hình để
  // trường hợp tách domain vẫn chạy được bằng WEB_ORIGIN (env schema bắt buộc biến này ở prod).
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({ origin, credentials: true });
  app.setGlobalPrefix('api');

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  Logger.log(`listening on port ${port} (prefix /api, env=${process.env.NODE_ENV ?? 'development'})`, 'Bootstrap');
}

void bootstrap();
