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

  // Security headers (X-Frame-Options, CSP, HSTS, etc.)
  app.use(helmet());

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

  // CORS: only allow panel's own origin
  const allowedOrigin = process.env.PANEL_URL || 'http://localhost:5173';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  const port = process.env.PORT || 3500;
  await app.listen(port);
  console.log(`LS-NGIX panel running on http://localhost:${port}`);
}
bootstrap();
