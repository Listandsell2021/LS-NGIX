import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AppsService } from './apps.service';
import { SshKeysService } from '../ssh-keys/ssh-keys.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { safeExec } from '../common/utils/safe-exec';
import { unlinkSync } from 'fs';

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(
    private readonly appsService: AppsService,
    private readonly sshKeysService: SshKeysService,
  ) {}

  @Post()
  create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Get()
  findAll() {
    return this.appsService.findAll();
  }

  @Get(':id/branches')
  async getBranches(@Param('id') id: string) {
    const app = await this.appsService.findOne(id);
    let keyPath: string | null = null;
    let env: NodeJS.ProcessEnv = { ...process.env };

    if (app.sshKeyId) {
      keyPath = await this.sshKeysService.writeKeyToTempFile(app.sshKeyId);
      env = {
        ...process.env,
        GIT_SSH_COMMAND: `ssh -i ${keyPath} -o StrictHostKeyChecking=no`,
      };
    }

    try {
      const result = await safeExec('git', ['ls-remote', '--heads', app.gitUrl], {
        timeout: 15_000,
        env,
      });
      const branches = result.stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => line.replace(/.*refs\/heads\//, ''));
      return { branches };
    } finally {
      if (keyPath) {
        try { unlinkSync(keyPath); } catch {}
      }
    }
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
