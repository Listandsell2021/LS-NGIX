import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helmet = require('helmet');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const dataDir = join(__dirname, '..', 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  // Security headers — Nginx handles these in production,
  // helmet only adds X-XSS-Protection, X-Content-Type-Options etc.
  // All cross-origin policies disabled to work on plain HTTP.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    hsts: false,
  }));

  // Parse cookies for httpOnly refresh tokens
  app.use(cookieParser());

  app.setGlobalPrefix('api');

  // Strict input validation — reject unknown fields
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: allow same-origin (served from NestJS) + dev server
  app.enableCors({
    origin: true, // Allow all origins (panel is same-origin in production)
    credentials: true,
  });

  const port = process.env.PORT || 3500;
  await app.listen(port);
  console.log(`LS-NGIX panel running on http://localhost:${port}`);
}
bootstrap();
