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

  const isProduction = process.env.NODE_ENV === 'production';

  // Security headers — relaxed for HTTP, strict for HTTPS
  app.use(helmet({
    contentSecurityPolicy: false, // Let the SPA work without CSP issues
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    hsts: isProduction, // Only set HSTS when behind HTTPS
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
