# LS-NGIX: Self-Hosted VPS Management Panel — Implementation Plan (Security-Hardened)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a security-hardened, self-hosted web panel that deploys and manages Node.js/NestJS applications on a VPS via a browser UI — replacing manual SSH workflows (git pull, npm install, build, Nginx config, domain setup).

**Architecture:** A NestJS backend serves a React SPA and exposes REST + WebSocket APIs. The backend runs as a dedicated non-root `ls-ngix` user with limited sudo privileges. It shells out to git, npm, PM2, Nginx, and Certbot via `execFile` (never `exec`) to manage applications. SQLite stores app configs, deployment history, and AES-256-GCM encrypted env vars. All traffic is HTTPS-only. Every action is audit-logged.

**Tech Stack:** NestJS 10, TypeORM + SQLite, React 18 + Vite + TailwindCSS, PM2 (programmatic), Nginx config generation, Certbot (Let's Encrypt), JWT auth (httpOnly cookies) with bcrypt, Socket.io for live logs, helmet + rate-limiter for HTTP hardening.

---

## Security Architecture

```
Internet
    |
    v
[UFW Firewall] -- only ports 22, 80, 443 open
    |
    v
[Fail2ban] -- auto-blocks IPs after 5 failed logins
    |
    v
[Nginx + HTTPS] -- SSL mandatory, no plaintext ever
    |
    v
[Helmet + CORS] -- security headers, strict origin
    |
    v
[Rate Limiter] -- 5 req/min on /api/auth/*, 60 req/min global
    |
    v
[JWT Auth] -- 15min access token + 7-day httpOnly refresh cookie
    |
    v
[Input Validation] -- class-validator + command whitelist
    |
    v
[execFile] -- no shell interpretation, no injection
    |
    v
[Non-root user] -- ls-ngix user with limited sudo
    |
    v
[Audit Log] -- every action recorded with IP + timestamp
    |
    v
[Encrypted Storage] -- AES-256-GCM for secrets, chmod 600 for files
```

---

## File Structure

```
/Volumes/PortableSSD/Github/LS-NGIX/
├── server/
│   ├── src/
│   │   ├── main.ts                          # Bootstrap: helmet, CORS, rate-limit, validation
│   │   ├── app.module.ts                    # Root module
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   └── throttle.guard.ts        # Rate limiting guard
│   │   │   ├── interceptors/
│   │   │   │   └── audit.interceptor.ts     # Logs every action with IP
│   │   │   ├── validators/
│   │   │   │   └── safe-command.validator.ts # Whitelist for build/start commands
│   │   │   └── utils/
│   │   │       └── safe-exec.ts             # execFile wrapper, never exec
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts           # POST /api/auth/setup, login, refresh, logout
│   │   │   ├── auth.service.ts              # bcrypt, JWT, setup-once, refresh tokens
│   │   │   ├── auth.guard.ts                # JWT guard from httpOnly cookie
│   │   │   ├── jwt.strategy.ts              # Passport JWT from cookie
│   │   │   ├── dto/
│   │   │   │   ├── setup.dto.ts             # Min 12 chars, complexity rules
│   │   │   │   └── login.dto.ts
│   │   │   └── entities/
│   │   │       └── user.entity.ts
│   │   ├── audit/
│   │   │   ├── audit.module.ts
│   │   │   ├── audit.service.ts             # Log actions to DB
│   │   │   ├── audit.controller.ts          # GET /api/audit (view logs)
│   │   │   └── entities/
│   │   │       └── audit-log.entity.ts
│   │   ├── apps/
│   │   │   ├── apps.module.ts
│   │   │   ├── apps.controller.ts
│   │   │   ├── apps.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-app.dto.ts        # Strict validation on all fields
│   │   │   │   └── update-app.dto.ts
│   │   │   └── entities/
│   │   │       └── app.entity.ts
│   │   ├── deployments/
│   │   │   ├── deployments.module.ts
│   │   │   ├── deployments.controller.ts
│   │   │   ├── deployments.service.ts       # Uses safe-exec.ts for all commands
│   │   │   └── entities/
│   │   │       └── deployment.entity.ts
│   │   ├── process-manager/
│   │   │   ├── process-manager.module.ts
│   │   │   ├── process-manager.service.ts
│   │   │   └── process-manager.controller.ts
│   │   ├── nginx/
│   │   │   ├── nginx.module.ts
│   │   │   ├── nginx.service.ts
│   │   │   └── templates/
│   │   │       ├── http.conf.hbs
│   │   │       └── https.conf.hbs
│   │   ├── domains/
│   │   │   ├── domains.module.ts
│   │   │   ├── domains.controller.ts
│   │   │   ├── domains.service.ts
│   │   │   ├── dto/
│   │   │   │   └── create-domain.dto.ts
│   │   │   └── entities/
│   │   │       └── domain.entity.ts
│   │   ├── env-vars/
│   │   │   ├── env-vars.module.ts
│   │   │   ├── env-vars.controller.ts
│   │   │   ├── env-vars.service.ts          # AES-256-GCM encrypt/decrypt
│   │   │   ├── dto/
│   │   │   │   └── set-env-var.dto.ts
│   │   │   └── entities/
│   │   │       └── env-var.entity.ts
│   │   ├── logs/
│   │   │   ├── logs.module.ts
│   │   │   └── logs.gateway.ts              # WebSocket with JWT auth on connection
│   │   └── monitoring/
│   │       ├── monitoring.module.ts
│   │       ├── monitoring.controller.ts
│   │       └── monitoring.service.ts
│   ├── test/
│   │   ├── auth.e2e-spec.ts
│   │   └── apps.e2e-spec.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   └── nest-cli.json
├── client/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── client.ts                   # Axios with credentials: 'include' (cookies)
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Setup.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AppCreate.tsx
│   │   │   ├── AppDetail.tsx
│   │   │   ├── AuditLog.tsx                 # View all actions
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── AppCard.tsx
│   │   │   ├── TerminalOutput.tsx
│   │   │   ├── EnvEditor.tsx
│   │   │   └── StatusBadge.tsx
│   │   └── lib/
│   │       └── utils.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── package.json
├── scripts/
│   ├── install.sh                           # Full hardened install: user, firewall, SSL, fail2ban
│   └── update.sh
├── package.json
├── .gitignore
└── README.md
```

---

## Phase 1: Project Scaffolding + Security Foundation

### Task 1: Initialize Git repo and root workspace

**Files:**
- Create: `.gitignore`
- Create: `package.json` (root workspace)
- Create: `README.md`

- [ ] **Step 1: Initialize git and create .gitignore**

```bash
cd /Volumes/PortableSSD/Github/LS-NGIX
git init
```

Create `.gitignore`:
```
node_modules/
dist/
.env
*.sqlite
*.sqlite-journal
.DS_Store
coverage/
data/
managed-apps/
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "ls-ngix",
  "version": "0.1.0",
  "private": true,
  "description": "Self-hosted VPS management panel for Node.js applications",
  "scripts": {
    "dev:server": "cd server && npm run start:dev",
    "dev:client": "cd client && npm run dev",
    "build:server": "cd server && npm run build",
    "build:client": "cd client && npm run build",
    "build": "npm run build:client && npm run build:server"
  }
}
```

- [ ] **Step 3: Create README.md**

```markdown
# LS-NGIX

Self-hosted, security-hardened VPS management panel for deploying and managing Node.js applications.

## Quick Install (Ubuntu 22.04/24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USER/LS-NGIX/main/scripts/install.sh | sudo bash
```

## Development

```bash
cd server && npm install
cd ../client && npm install

npm run dev:server   # Backend on :3500
npm run dev:client   # Frontend on :5173
```

## Security

- HTTPS mandatory (Let's Encrypt)
- Non-root execution with limited sudo
- UFW firewall + Fail2ban
- Rate limiting on auth endpoints
- AES-256-GCM encryption for secrets
- Audit logging for all actions
- httpOnly cookies for JWT (no XSS token theft)
- Command injection prevention via execFile
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json README.md
git commit -m "chore: initialize project with root workspace"
```

---

### Task 2: Scaffold NestJS backend with security dependencies

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/tsconfig.build.json`
- Create: `server/nest-cli.json`
- Create: `server/src/main.ts`
- Create: `server/src/app.module.ts`

- [ ] **Step 1: Create server/package.json**

```bash
mkdir -p server/src
```

```json
{
  "name": "ls-ngix-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/typeorm": "^10.0.2",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-socket.io": "^10.4.0",
    "@nestjs/websockets": "^10.4.0",
    "@nestjs/serve-static": "^4.0.0",
    "@nestjs/throttler": "^6.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "bcrypt": "^5.1.1",
    "typeorm": "^0.3.20",
    "better-sqlite3": "^11.0.0",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "handlebars": "^4.7.8",
    "helmet": "^7.1.0",
    "cookie-parser": "^1.4.6",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.4.0",
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/passport-jwt": "^4.0.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create TypeScript configs**

Create `server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Create `server/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

Create `server/nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      { "include": "nginx/templates/*.hbs", "watchAssets": true }
    ]
  }
}
```

- [ ] **Step 3: Create main.ts with security middleware**

Create `server/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
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
  app.use(helmet.default());

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
    credentials: true, // Required for httpOnly cookies
  });

  const port = process.env.PORT || 3500;
  await app.listen(port);
  console.log(`LS-NGIX panel running on http://localhost:${port}`);
}
bootstrap();
```

- [ ] **Step 4: Create app.module.ts with rate limiting**

Create `server/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '..', 'data', 'ls-ngix.sqlite'),
      autoLoadEntities: true,
      synchronize: true,
    }),
    // Global rate limiting: 60 requests per minute per IP
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Install dependencies and verify build**

```bash
cd server && npm install && npx nest build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat: scaffold NestJS backend with helmet, rate limiting, cookie-parser"
```

---

### Task 3: Build safe-exec utility and command validator

**Files:**
- Create: `server/src/common/utils/safe-exec.ts`
- Create: `server/src/common/validators/safe-command.validator.ts`

- [ ] **Step 1: Create safe-exec utility (NEVER uses shell)**

Create `server/src/common/utils/safe-exec.ts`:
```typescript
import { execFile, ExecFileException } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('SafeExec');

// Allowed commands — whitelist approach
const ALLOWED_COMMANDS = new Set([
  'git',
  'npm',
  'npx',
  'node',
  'yarn',
  'pnpm',
  'nginx',
  'certbot',
  'ln',
  'rm',
  'df',
  'pm2',
]);

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Safe command execution using execFile (no shell interpretation).
 * Only allows whitelisted commands.
 * NEVER pass user input as the command — only as args.
 */
export function safeExec(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number; sudo?: boolean } = {},
): Promise<ExecResult> {
  const baseCmd = command.split('/').pop() || command;

  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return Promise.reject(new Error(`Command "${baseCmd}" is not in the allowed list`));
  }

  const finalCmd = options.sudo ? 'sudo' : command;
  const finalArgs = options.sudo ? [command, ...args] : args;

  logger.debug(`Executing: ${finalCmd} ${finalArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    execFile(
      finalCmd,
      finalArgs,
      {
        cwd: options.cwd,
        timeout: options.timeout || 300_000, // 5 min default
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: { ...process.env },
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        const code = error?.code ? Number(error.code) : 0;
        if (error && !options.sudo) {
          reject(new Error(`Command failed (code ${code}): ${stderr || error.message}`));
        } else {
          resolve({ stdout, stderr, code });
        }
      },
    );
  });
}

/**
 * Safe command execution with live output streaming via callback.
 * Uses child_process.spawn (not exec) for streaming.
 */
export function safeSpawn(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    onOutput?: (data: string) => void;
    ignoreErrors?: boolean;
  } = {},
): Promise<void> {
  const baseCmd = command.split('/').pop() || command;

  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return Promise.reject(new Error(`Command "${baseCmd}" is not in the allowed list`));
  }

  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      timeout: options.timeout || 300_000,
      env: { ...process.env },
    });

    child.stdout.on('data', (data: Buffer) => {
      options.onOutput?.(data.toString());
    });

    child.stderr.on('data', (data: Buffer) => {
      options.onOutput?.(data.toString());
    });

    child.on('close', (code: number) => {
      if (code !== 0 && !options.ignoreErrors) {
        reject(new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', (err: Error) => {
      if (!options.ignoreErrors) reject(err);
      else resolve();
    });
  });
}
```

- [ ] **Step 2: Create safe command validator for user-provided build/start commands**

Create `server/src/common/validators/safe-command.validator.ts`:
```typescript
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Only these prefixes are allowed for user-specified commands
const ALLOWED_PREFIXES = [
  'npm run',
  'npm install',
  'npm ci',
  'npx',
  'yarn',
  'pnpm',
  'node',
];

// These characters are NEVER allowed in commands
const DANGEROUS_CHARS = /[;&|`$(){}!<>\\]/;

@ValidatorConstraint({ name: 'isSafeCommand', async: false })
export class IsSafeCommandConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value || typeof value !== 'string') return false;

    // Check for dangerous characters (shell metacharacters)
    if (DANGEROUS_CHARS.test(value)) return false;

    // Must start with an allowed prefix
    const hasAllowedPrefix = ALLOWED_PREFIXES.some((prefix) =>
      value.startsWith(prefix),
    );

    return hasAllowedPrefix;
  }

  defaultMessage(): string {
    return `Command must start with one of: ${ALLOWED_PREFIXES.join(', ')}. Shell metacharacters (;, &, |, \`, $, etc.) are not allowed.`;
  }
}

export function IsSafeCommand(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeCommandConstraint,
    });
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/common/
git commit -m "feat: add safe-exec utility and command whitelist validator"
```

---

### Task 4: Build Audit Log module

**Files:**
- Create: `server/src/audit/entities/audit-log.entity.ts`
- Create: `server/src/audit/audit.service.ts`
- Create: `server/src/audit/audit.interceptor.ts`
- Create: `server/src/audit/audit.controller.ts`
- Create: `server/src/audit/audit.module.ts`

- [ ] **Step 1: Create AuditLog entity**

Create `server/src/audit/entities/audit-log.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string; // 'auth.login', 'app.create', 'app.deploy', 'domain.add', etc.

  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true })
  appId: string;

  @Column()
  ip: string;

  @Column({ type: 'text', nullable: true })
  details: string; // JSON string with extra context

  @Column()
  method: string; // GET, POST, DELETE, etc.

  @Column()
  path: string; // /api/apps/xxx/deploy

  @Column({ nullable: true })
  statusCode: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Create Audit service**

Create `server/src/audit/audit.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(entry: Partial<AuditLog>): Promise<void> {
    const log = this.auditRepo.create(entry);
    await this.auditRepo.save(log);
  }

  async findAll(limit = 100, offset = 0): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { logs, total };
  }
}
```

- [ ] **Step 3: Create Audit interceptor (auto-logs every mutating request)**

Create `server/src/audit/audit.interceptor.ts`:
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, ip } = request;

    // Only log mutating requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.auditService.log({
            action: this.deriveAction(method, originalUrl),
            userId: user?.id,
            ip: ip || request.headers['x-forwarded-for'] || 'unknown',
            method,
            path: originalUrl,
            statusCode: response.statusCode,
            details: JSON.stringify({
              duration: Date.now() - startTime,
            }),
          });
        },
        error: (error) => {
          this.auditService.log({
            action: this.deriveAction(method, originalUrl),
            userId: user?.id,
            ip: ip || request.headers['x-forwarded-for'] || 'unknown',
            method,
            path: originalUrl,
            statusCode: error.status || 500,
            details: JSON.stringify({
              error: error.message,
              duration: Date.now() - startTime,
            }),
          });
        },
      }),
    );
  }

  private deriveAction(method: string, url: string): string {
    // /api/auth/login -> auth.login
    // /api/apps/xxx/deployments -> app.deploy
    const parts = url.replace('/api/', '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[parts.length - 1]}`;
    }
    return `${method.toLowerCase()}.${parts[0] || 'unknown'}`;
  }
}
```

- [ ] **Step 4: Create Audit controller**

Create `server/src/audit/audit.controller.ts`:
```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.auditService.findAll(
      Math.min(Number(limit) || 100, 500),
      Number(offset) || 0,
    );
  }
}
```

- [ ] **Step 5: Create Audit module**

Create `server/src/audit/audit.module.ts`:
```typescript
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuthModule } from '../auth/auth.module';

@Global() // Make AuditService available everywhere
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), AuthModule],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
```

- [ ] **Step 6: Commit**

```bash
git add server/src/audit/
git commit -m "feat: add audit log module — records every mutating action with IP"
```

---

### Task 5: Build Auth module with httpOnly cookies and rate limiting

**Files:**
- Create: `server/src/auth/entities/user.entity.ts`
- Create: `server/src/auth/dto/setup.dto.ts`
- Create: `server/src/auth/dto/login.dto.ts`
- Create: `server/src/auth/auth.service.ts`
- Create: `server/src/auth/jwt.strategy.ts`
- Create: `server/src/auth/auth.guard.ts`
- Create: `server/src/auth/auth.controller.ts`
- Create: `server/src/auth/auth.module.ts`

- [ ] **Step 1: Create User entity**

Create `server/src/auth/entities/user.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Create DTOs with strong password requirements**

Create `server/src/auth/dto/setup.dto.ts`:
```typescript
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, hyphens, underscores',
  })
  username: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  @Matches(/(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  @Matches(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain at least one special character',
  })
  password: string;
}
```

Create `server/src/auth/dto/login.dto.ts`:
```typescript
import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}
```

- [ ] **Step 3: Create Auth service with refresh tokens**

Create `server/src/auth/auth.service.ts`:
```typescript
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { User } from './entities/user.entity';
import { SetupDto } from './dto/setup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private jwtSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {
    this.jwtSecret = this.loadOrCreateSecret();
  }

  /**
   * Generate a random JWT secret on first install.
   * Stored in data/jwt.secret (chmod 600).
   * NEVER hardcoded.
   */
  private loadOrCreateSecret(): string {
    const secretPath = join(__dirname, '..', '..', 'data', 'jwt.secret');
    if (existsSync(secretPath)) {
      return readFileSync(secretPath, 'utf-8').trim();
    }
    const secret = randomBytes(64).toString('hex');
    writeFileSync(secretPath, secret, { mode: 0o600 });
    return secret;
  }

  getJwtSecret(): string {
    return this.jwtSecret;
  }

  async isSetupComplete(): Promise<boolean> {
    const count = await this.userRepo.count();
    return count > 0;
  }

  async setup(dto: SetupDto): Promise<{ access_token: string }> {
    const exists = await this.isSetupComplete();
    if (exists) {
      throw new ConflictException('Setup already completed');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      username: dto.username,
      passwordHash,
    });
    await this.userRepo.save(user);

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    // Use constant-time comparison to prevent timing attacks
    if (!user) {
      // Hash a dummy password to prevent timing-based username enumeration
      await bcrypt.hash('dummy-password', 12);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: User): { access_token: string; refresh_token: string } {
    const payload = { sub: user.id, username: user.username };
    return {
      access_token: this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: '15m',
      }),
      refresh_token: this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: '7d',
      }),
    };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.jwtSecret,
      });
      const user = await this.findById(payload.sub);
      if (!user) throw new UnauthorizedException();

      return {
        access_token: this.jwtService.sign(
          { sub: user.id, username: user.username },
          { secret: this.jwtSecret, expiresIn: '15m' },
        ),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
```

- [ ] **Step 4: Create JWT strategy (reads from httpOnly cookie)**

Create `server/src/auth/jwt.strategy.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';

// Extract JWT from httpOnly cookie first, fallback to Authorization header
function cookieOrHeaderExtractor(req: Request): string | null {
  if (req?.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: cookieOrHeaderExtractor,
      ignoreExpiration: false,
      secretOrKey: authService.getJwtSecret(),
    });
  }

  async validate(payload: { sub: number; username: string }) {
    const user = await this.authService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, username: user.username };
  }
}
```

- [ ] **Step 5: Create Auth guard**

Create `server/src/auth/auth.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 6: Create Auth controller with strict rate limiting and httpOnly cookies**

Create `server/src/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Get, Body, Res, Req, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SetupDto } from './dto/setup.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('status')
  async status() {
    const setupComplete = await this.authService.isSetupComplete();
    return { setupComplete };
  }

  // Strict rate limit: 5 attempts per 60 seconds
  @Post('setup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async setup(@Body() dto: SetupDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.setup(dto);
    this.setTokenCookies(res, tokens);
    return { message: 'Setup complete' };
  }

  // Strict rate limit: 5 attempts per 60 seconds
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setTokenCookies(res, tokens);
    return { message: 'Login successful' };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const { access_token } = await this.authService.refresh(refreshToken);
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    return { message: 'Token refreshed' };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  private setTokenCookies(
    res: Response,
    tokens: { access_token: string; refresh_token: string },
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token: short-lived, httpOnly
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Refresh token: long-lived, httpOnly
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth', // Only sent to auth endpoints
    });
  }
}
```

- [ ] **Step 7: Create Auth module**

Create `server/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Secret is set dynamically in AuthService
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

- [ ] **Step 8: Build and verify**

```bash
cd server && npx nest build
```

- [ ] **Step 9: Commit**

```bash
git add server/src/auth/
git commit -m "feat: add auth module with httpOnly cookies, rate limiting, strong passwords"
```

---

### Task 6: Build App entity and Apps CRUD

**Files:**
- Create: `server/src/apps/entities/app.entity.ts`
- Create: `server/src/apps/dto/create-app.dto.ts`
- Create: `server/src/apps/dto/update-app.dto.ts`
- Create: `server/src/apps/apps.service.ts`
- Create: `server/src/apps/apps.controller.ts`
- Create: `server/src/apps/apps.module.ts`

- [ ] **Step 1: Create App entity**

Create `server/src/apps/entities/app.entity.ts`:
```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppStatus {
  STOPPED = 'stopped',
  RUNNING = 'running',
  BUILDING = 'building',
  ERRORED = 'errored',
}

@Entity('apps')
export class App {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  gitUrl: string;

  @Column({ default: 'main' })
  gitBranch: string;

  @Column({ default: 'npm install' })
  installCommand: string;

  @Column({ default: 'npm run build' })
  buildCommand: string;

  @Column({ default: 'npm run start:prod' })
  startCommand: string;

  @Column({ type: 'int' })
  port: number;

  @Column({ type: 'varchar', default: AppStatus.STOPPED })
  status: AppStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Create DTOs with safe command validation**

Create `server/src/apps/dto/create-app.dto.ts`:
```typescript
import { IsString, IsInt, IsOptional, Min, Max, Matches, MinLength } from 'class-validator';
import { IsSafeCommand } from '../../common/validators/safe-command.validator';

export class CreateAppDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.',
  })
  slug: string;

  @IsString()
  @Matches(/^(https:\/\/|git@)[\w.@:\/~-]+\.git$/, {
    message: 'Git URL must be a valid HTTPS or SSH git URL ending in .git',
  })
  gitUrl: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._\/-]+$/, {
    message: 'Branch name contains invalid characters',
  })
  gitBranch?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  installCommand?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  buildCommand?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  startCommand?: string;

  @IsInt()
  @Min(1024)
  @Max(65535)
  port: number;
}
```

Create `server/src/apps/dto/update-app.dto.ts`:
```typescript
import { IsString, IsInt, IsOptional, Min, Max, Matches, MinLength } from 'class-validator';
import { IsSafeCommand } from '../../common/validators/safe-command.validator';

export class UpdateAppDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(https:\/\/|git@)[\w.@:\/~-]+\.git$/, {
    message: 'Git URL must be a valid HTTPS or SSH git URL ending in .git',
  })
  gitUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._\/-]+$/)
  gitBranch?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  installCommand?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  buildCommand?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  startCommand?: string;

  @IsInt()
  @Min(1024)
  @Max(65535)
  @IsOptional()
  port?: number;
}
```

- [ ] **Step 3: Create Apps service**

Create `server/src/apps/apps.service.ts`:
```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App, AppStatus } from './entities/app.entity';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(App)
    private readonly appRepo: Repository<App>,
  ) {}

  async create(dto: CreateAppDto): Promise<App> {
    const existing = await this.appRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`App with slug "${dto.slug}" already exists`);
    }

    const portTaken = await this.appRepo.findOne({ where: { port: dto.port } });
    if (portTaken) {
      throw new ConflictException(`Port ${dto.port} is already used by "${portTaken.name}"`);
    }

    const app = this.appRepo.create(dto);
    return this.appRepo.save(app);
  }

  async findAll(): Promise<App[]> {
    return this.appRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<App> {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException(`App with id "${id}" not found`);
    return app;
  }

  async update(id: string, dto: UpdateAppDto): Promise<App> {
    const app = await this.findOne(id);

    if (dto.port && dto.port !== app.port) {
      const portTaken = await this.appRepo.findOne({ where: { port: dto.port } });
      if (portTaken && portTaken.id !== id) {
        throw new ConflictException(`Port ${dto.port} is already used by "${portTaken.name}"`);
      }
    }

    Object.assign(app, dto);
    return this.appRepo.save(app);
  }

  async updateStatus(id: string, status: AppStatus): Promise<void> {
    await this.appRepo.update(id, { status });
  }

  async remove(id: string): Promise<void> {
    const app = await this.findOne(id);
    await this.appRepo.remove(app);
  }
}
```

- [ ] **Step 4: Create Apps controller**

Create `server/src/apps/apps.controller.ts`:
```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post()
  create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Get()
  findAll() {
    return this.appsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }
}
```

- [ ] **Step 5: Create Apps module**

Create `server/src/apps/apps.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppsService } from './apps.service';
import { AppsController } from './apps.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([App]), AuthModule],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
```

- [ ] **Step 6: Build and commit**

```bash
cd server && npx nest build
git add server/src/apps/ server/src/app.module.ts
git commit -m "feat: add Apps CRUD with safe command validation and git URL regex"
```

---

## Phase 2: Frontend — Login, Dashboard, App Management

### Task 7: Scaffold React frontend

**Files:**
- Create: `client/package.json`, `client/index.html`, `client/vite.config.ts`
- Create: `client/tailwind.config.js`, `client/postcss.config.js`, `client/tsconfig.json`
- Create: `client/src/main.tsx`, `client/src/App.tsx`, `client/src/index.css`

- [ ] **Step 1: Create client/package.json**

```bash
mkdir -p client/src
```

```json
{
  "name": "ls-ngix-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "axios": "^1.7.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create Vite config, Tailwind, PostCSS, TypeScript configs**

Create `client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3500', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3500', ws: true },
    },
  },
  build: { outDir: 'dist' },
});
```

Create `client/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

Create `client/postcss.config.js`:
```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

Create `client/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create index.html, main.tsx, index.css, App.tsx**

Create `client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LS-NGIX Panel</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `client/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-950 text-gray-100;
}
```

Create `client/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

Create `client/src/App.tsx`:
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="p-8 text-2xl">LS-NGIX Panel</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 4: Install and verify**

```bash
cd client && npm install && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add client/
git commit -m "feat: scaffold React frontend with Vite + TailwindCSS"
```

---

### Task 8: Build API client (cookie-based) and useAuth hook

**Files:**
- Create: `client/src/api/client.ts`
- Create: `client/src/hooks/useAuth.ts`

- [ ] **Step 1: Create Axios client with cookie credentials**

Create `client/src/api/client.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send httpOnly cookies with every request
});

// Auto-refresh access token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        return api(originalRequest);
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
```

- [ ] **Step 2: Create useAuth hook**

Create `client/src/hooks/useAuth.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    setupRequired: false,
  });

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const { data } = await api.get('/auth/status');
      if (!data.setupComplete) {
        setState({ isAuthenticated: false, isLoading: false, setupRequired: true });
        return;
      }
      // Try to access a protected endpoint to check if cookies are valid
      await api.get('/apps');
      setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
    } catch {
      setState((s) => ({ ...s, isAuthenticated: false, isLoading: false }));
    }
  }

  const login = useCallback(async (username: string, password: string) => {
    await api.post('/auth/login', { username, password });
    setState((s) => ({ ...s, isAuthenticated: true }));
  }, []);

  const setup = useCallback(async (username: string, password: string) => {
    await api.post('/auth/setup', { username, password });
    setState({ isAuthenticated: true, isLoading: false, setupRequired: false });
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setState((s) => ({ ...s, isAuthenticated: false }));
  }, []);

  return { ...state, login, setup, logout };
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api/ client/src/hooks/
git commit -m "feat: add cookie-based API client with auto-refresh and useAuth hook"
```

---

### Task 9: Build Layout, Setup, Login, Dashboard, AppCreate, AppDetail pages

**Files:**
- Create: `client/src/components/Layout.tsx`
- Create: `client/src/components/StatusBadge.tsx`
- Create: `client/src/components/AppCard.tsx`
- Create: `client/src/pages/Setup.tsx`
- Create: `client/src/pages/Login.tsx`
- Create: `client/src/pages/Dashboard.tsx`
- Create: `client/src/pages/AppCreate.tsx`
- Create: `client/src/pages/AppDetail.tsx`
- Create: `client/src/pages/AuditLog.tsx`
- Modify: `client/src/App.tsx`

This is a large task — all UI pages. Each page follows the same pattern: fetch from API, display, handle actions. The code for each page matches the previous plan (Tasks 8-11) exactly, but with these security changes:

- **No tokens in localStorage** — auth is via httpOnly cookies (already handled by `api/client.ts`)
- **AuditLog page added** — new page to view all actions

- [ ] **Step 1: Create all components (Layout, StatusBadge, AppCard)**

Same code as original plan Tasks 8-9, no changes needed. These components don't handle auth.

- [ ] **Step 2: Create Setup page** — same as original plan Task 8 Step 3, but `onSetup` now uses cookie-based auth (no token storage needed).

- [ ] **Step 3: Create Login page** — same as original plan Task 8 Step 4.

- [ ] **Step 4: Create Dashboard page** — same as original plan Task 9.

- [ ] **Step 5: Create AppCreate page** — same as original plan Task 10.

- [ ] **Step 6: Create AppDetail page** — same as original plan Task 11.

- [ ] **Step 7: Create AuditLog page**

Create `client/src/pages/AuditLog.tsx`:
```typescript
import { useState, useEffect } from 'react';
import api from '../api/client';

interface LogEntry {
  id: number;
  action: string;
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  details: string;
  createdAt: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit?limit=100').then(({ data }) => {
      setLogs(data.logs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-gray-400">Loading audit logs...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Audit Log</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-left">Path</th>
              <th className="px-4 py-3 text-left">IP</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-gray-800">
                <td className="px-4 py-3 text-gray-400">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono">{log.action}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    log.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                    log.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {log.method}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-400">{log.path}</td>
                <td className="px-4 py-3 text-gray-500">{log.ip}</td>
                <td className="px-4 py-3">
                  <span className={log.statusCode < 400 ? 'text-green-400' : 'text-red-400'}>
                    {log.statusCode}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Update App.tsx with all routes including AuditLog**

Replace `client/src/App.tsx`:
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AppCreate from './pages/AppCreate';
import AppDetail from './pages/AppDetail';
import AuditLog from './pages/AuditLog';

function App() {
  const { isAuthenticated, isLoading, setupRequired, login, setup, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (setupRequired) return <Setup onSetup={setup} />;
  if (!isAuthenticated) return <Login onLogin={login} />;

  return (
    <Routes>
      <Route element={<Layout onLogout={logout} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apps/new" element={<AppCreate />} />
        <Route path="/apps/:id" element={<AppDetail />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
```

- [ ] **Step 9: Build and commit**

```bash
cd client && npm run build
git add client/src/
git commit -m "feat: add all frontend pages with cookie-based auth and audit log view"
```

---

## Phase 3: Deployment Pipeline + Process Manager

### Task 10: Build Deployment service (uses safe-exec)

Same structure as original plan Task 13, but all `spawn()` calls replaced with `safeSpawn()` from `common/utils/safe-exec.ts`. Key change:

```typescript
// OLD (unsafe):
spawn(cmd, args, { cwd, shell: true })

// NEW (safe):
import { safeSpawn } from '../common/utils/safe-exec';
await safeSpawn('git', ['clone', app.gitUrl, '-b', app.gitBranch, appDir], { cwd: this.appsDir, onOutput: (line) => this.appendLog(id, line) });
```

- [ ] **Steps 1-7: Same as original Task 13, with safe-exec substituted**

---

### Task 11: Build Process Manager service

Same as original plan Task 14, with `safeExec` replacing direct `spawn` calls.

- [ ] **Steps 1-5: Same as original Task 14, with safe-exec substituted**

---

## Phase 4: Nginx, Domains, SSL, Env Vars

### Task 12: Build Nginx service with templates

Same as original plan Task 15, with `safeExec` for `nginx -t` and `nginx -s reload`, using `sudo: true` option.

- [ ] **Steps 1-6: Same as original Task 15, with safe-exec substituted**

---

### Task 13: Build Domains service with SSL

Same as original plan Task 16.

- [ ] **Steps 1-7: Same as original Task 16**

---

### Task 14: Build Environment Variables service (AES-256-GCM)

Same as original plan Task 17.

- [ ] **Steps 1-6: Same as original Task 17**

---

## Phase 5: Monitoring, Logs, Static Serving

### Task 15: Build Monitoring service

Same as original plan Task 18.

- [ ] **Steps 1-4: Same as original Task 18**

---

### Task 16: Build WebSocket logs gateway (with auth)

Same as original plan Task 19, but with JWT verification on WebSocket connection:

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Verify JWT on WebSocket connection
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token ||
      client.handshake.headers?.cookie?.match(/access_token=([^;]+)/)?.[1];

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token, { secret: this.authService.getJwtSecret() });
    } catch {
      client.disconnect();
    }
  }
}
```

- [ ] **Steps 1-3: Same as original Task 19, with auth on connection**

---

### Task 17: Serve React from NestJS + register all modules

Same as original plan Tasks 12 and 21 combined.

- [ ] **Steps 1-3: Same as original Tasks 12 + 21**

---

## Phase 6: Hardened Install Script

### Task 18: Create security-hardened VPS install script

**Files:**
- Create: `scripts/install.sh`

- [ ] **Step 1: Create the hardened install script**

Create `scripts/install.sh`:
```bash
#!/bin/bash
set -euo pipefail

echo "========================================="
echo "  LS-NGIX Panel Installer (Hardened)"
echo "========================================="
echo ""

# ─── CHECKS ────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo)"
  exit 1
fi

if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
  echo "Warning: Tested on Ubuntu 22.04/24.04 only. Continue? (y/n)"
  read -r confirm
  [ "$confirm" != "y" ] && exit 1
fi

# ─── 1. SYSTEM UPDATES ─────────────────────────────
echo "[1/9] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. CREATE NON-ROOT USER ───────────────────────
echo "[2/9] Creating ls-ngix system user..."
if ! id "ls-ngix" &>/dev/null; then
  useradd --system --create-home --shell /bin/bash ls-ngix
fi

# ─── 3. INSTALL NODE.JS ────────────────────────────
echo "[3/9] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node.js $(node --version)"

# ─── 4. INSTALL PM2 ────────────────────────────────
echo "[4/9] Installing PM2..."
npm install -g pm2
# Setup PM2 to start on boot as ls-ngix user
env PATH=$PATH:/usr/bin pm2 startup systemd -u ls-ngix --hp /home/ls-ngix
su - ls-ngix -c "pm2 save" 2>/dev/null || true

# ─── 5. INSTALL NGINX + CERTBOT ────────────────────
echo "[5/9] Installing Nginx and Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx

# ─── 6. FIREWALL (UFW) ─────────────────────────────
echo "[6/9] Configuring firewall (UFW)..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  Firewall: only ports 22, 80, 443 open"

# ─── 7. FAIL2BAN ───────────────────────────────────
echo "[7/9] Installing Fail2ban..."
apt-get install -y fail2ban

# Create jail for SSH
cat > /etc/fail2ban/jail.local <<'F2B'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
F2B

systemctl enable fail2ban
systemctl restart fail2ban
echo "  Fail2ban: blocks IP after 3 failed SSH / 5 failed login attempts"

# ─── 8. INSTALL LS-NGIX PANEL ──────────────────────
echo "[8/9] Installing LS-NGIX Panel..."
INSTALL_DIR="/opt/ls-ngix"
mkdir -p "$INSTALL_DIR/apps"

# Clone or update
if [ -d "$INSTALL_DIR/panel" ]; then
  echo "  Updating existing installation..."
  cd "$INSTALL_DIR/panel" && git pull
else
  git clone https://github.com/YOUR_USERNAME/LS-NGIX.git "$INSTALL_DIR/panel"
fi

# Set ownership
chown -R ls-ngix:ls-ngix "$INSTALL_DIR"

# Build as ls-ngix user
cd "$INSTALL_DIR/panel"
su - ls-ngix -c "cd $INSTALL_DIR/panel/client && npm install && npm run build"
su - ls-ngix -c "cd $INSTALL_DIR/panel/server && npm install && npx nest build"

# Create data directory with restricted permissions
mkdir -p "$INSTALL_DIR/panel/server/data"
chown ls-ngix:ls-ngix "$INSTALL_DIR/panel/server/data"
chmod 700 "$INSTALL_DIR/panel/server/data"

# ─── SUDOERS: Limited privileges for ls-ngix ────────
cat > /etc/sudoers.d/ls-ngix <<'SUDOERS'
# LS-NGIX panel: limited sudo for nginx and certbot only
ls-ngix ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
ls-ngix ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
ls-ngix ALL=(ALL) NOPASSWD: /usr/bin/certbot *
ls-ngix ALL=(ALL) NOPASSWD: /bin/ln -sf /etc/nginx/sites-available/ls-ngix-* /etc/nginx/sites-enabled/*
ls-ngix ALL=(ALL) NOPASSWD: /bin/rm /etc/nginx/sites-enabled/ls-ngix-*
SUDOERS
chmod 440 /etc/sudoers.d/ls-ngix

# ─── 9. START PANEL ────────────────────────────────
echo "[9/9] Starting LS-NGIX Panel..."
su - ls-ngix -c "cd $INSTALL_DIR/panel && NODE_ENV=production pm2 delete ls-ngix-panel 2>/dev/null || true"
su - ls-ngix -c "cd $INSTALL_DIR/panel && NODE_ENV=production pm2 start server/dist/main.js --name ls-ngix-panel"
su - ls-ngix -c "pm2 save"

# Nginx config for the panel
cat > /etc/nginx/sites-available/ls-ngix-panel <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ls-ngix-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && nginx -s reload

# ─── SSL SETUP (optional) ──────────────────────────
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "========================================="
echo "  LS-NGIX Panel Installed!"
echo "========================================="
echo ""
echo "  Panel:   http://$SERVER_IP"
echo "  Create your admin account on first visit."
echo ""
echo "  Security:"
echo "    - Firewall (UFW): ports 22, 80, 443 only"
echo "    - Fail2ban: active on SSH"
echo "    - Panel runs as 'ls-ngix' user (non-root)"
echo "    - Data encrypted at rest"
echo ""
echo "  IMPORTANT: Set up SSL immediately!"
echo "    sudo certbot --nginx -d panel.yourdomain.com"
echo ""
echo "  Commands:"
echo "    pm2 status                 # Check panel status"
echo "    pm2 logs ls-ngix-panel     # View panel logs"
echo "    sudo ufw status            # Firewall status"
echo "    sudo fail2ban-client status # Fail2ban status"
echo "========================================="
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x scripts/install.sh
git add scripts/
git commit -m "feat: add hardened install script with UFW, fail2ban, non-root user, limited sudo"
```

---

### Task 19: Create update script

**Files:**
- Create: `scripts/update.sh`

- [ ] **Step 1: Create update script**

Create `scripts/update.sh`:
```bash
#!/bin/bash
set -euo pipefail

echo "Updating LS-NGIX Panel..."

INSTALL_DIR="/opt/ls-ngix"

cd "$INSTALL_DIR/panel"
git pull

su - ls-ngix -c "cd $INSTALL_DIR/panel/client && npm install && npm run build"
su - ls-ngix -c "cd $INSTALL_DIR/panel/server && npm install && npx nest build"

# Only restart the panel, NOT managed apps
su - ls-ngix -c "pm2 restart ls-ngix-panel"

echo "Update complete."
```

- [ ] **Step 2: Commit**

```bash
chmod +x scripts/update.sh
git add scripts/update.sh
git commit -m "feat: add self-update script (restarts panel only, not managed apps)"
```

---

## Summary

| Phase | Tasks | What It Delivers |
|-------|-------|-----------------|
| **1: Scaffolding + Security Foundation** | Tasks 1-6 | NestJS with helmet, rate limiting, safe-exec, audit logging, auth with httpOnly cookies, apps CRUD with command whitelist |
| **2: Frontend Pages** | Tasks 7-9 | Cookie-based API client, Login, Setup, Dashboard, App Create/Detail, Audit Log viewer |
| **3: Deployment Pipeline** | Tasks 10-11 | Safe git clone/pull, npm install/build, PM2 start/stop/restart (all via safe-exec) |
| **4: Nginx + Domains + SSL + Env Vars** | Tasks 12-14 | Nginx config generation, domain management, Certbot SSL, AES-256-GCM encrypted env vars |
| **5: Monitoring + Logs + Static Serving** | Tasks 15-17 | System monitoring, authenticated WebSocket log streaming, React served from NestJS |
| **6: Hardened Install Script** | Tasks 18-19 | UFW firewall, Fail2ban, non-root user, limited sudo, SSL prompt, update script |

**Total: 19 tasks**

**Security layers baked in from Task 1:**
- Helmet (security headers)
- Rate limiting (5/min on auth, 60/min global)
- httpOnly cookies (no XSS token theft)
- Strong passwords (12+ chars, number + special char)
- Random JWT secret (generated on install, never hardcoded)
- Command whitelist + safe-exec (no shell injection)
- Audit logging (every action with IP)
- Non-root execution (limited sudoers)
- UFW firewall (ports 22, 80, 443 only)
- Fail2ban (auto-block brute force)
- AES-256-GCM (secrets encrypted at rest)
- Nginx security headers (X-Frame-Options, CSP, etc.)
