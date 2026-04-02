import { Controller, Post, Get, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ProcessManagerService } from './process-manager.service';
import { safeExec } from '../common/utils/safe-exec';
import { existsSync } from 'fs';
import { join } from 'path';

@Controller('apps/:slug/process')
@UseGuards(JwtAuthGuard)
export class ProcessManagerController {
  constructor(private readonly pm: ProcessManagerService) {}

  @Post('stop')
  stop(@Param('slug') slug: string) {
    return this.pm.stop(slug);
  }

  @Post('restart')
  restart(@Param('slug') slug: string) {
    return this.pm.restart(slug);
  }

  @Get('status')
  status(@Param('slug') slug: string) {
    return this.pm.status(slug);
  }

  @Get('logs')
  logs(@Param('slug') slug: string) {
    return this.pm.logs(slug);
  }

  @Post('run-command')
  async runCommand(@Param('slug') slug: string, @Body() body: { command: string }) {
    const { command } = body;
    if (!command || typeof command !== 'string') {
      throw new BadRequestException('Command is required');
    }

    const parts = command.trim().split(/\s+/);
    const bin = parts[0];
    const args = parts.slice(1);

    // Only allow safe commands
    const allowed = ['npm', 'npx', 'node', 'yarn', 'pnpm', 'git', 'ls', 'cat', 'pm2'];
    if (!allowed.includes(bin)) {
      throw new BadRequestException(`Command "${bin}" is not allowed. Allowed: ${allowed.join(', ')}`);
    }

    // Reject shell metacharacters
    if (/[;&|`$(){}!<>\\]/.test(command)) {
      throw new BadRequestException('Shell metacharacters are not allowed');
    }

    const appsDir = process.env.APPS_DIR || join(__dirname, '..', '..', 'managed-apps');
    const appDir = join(appsDir, slug, 'source');
    const cwd = existsSync(appDir) ? appDir : appsDir;

    try {
      const result = await safeExec(bin, args, { cwd, timeout: 60_000 });
      return { output: result.stdout + (result.stderr ? '\n' + result.stderr : ''), code: result.code };
    } catch (err: any) {
      return { output: err.message, code: 1 };
    }
  }
}
