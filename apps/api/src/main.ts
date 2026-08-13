import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Validate input ở biên bằng allowlist (chống mass assignment). Xem sk-dto-validation.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({ origin, credentials: true });
  app.setGlobalPrefix('api');

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`[api] listening on http://localhost:${port}/api`);
}

void bootstrap();
