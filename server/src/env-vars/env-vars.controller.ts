import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { EnvVarsService } from './env-vars.service';
import { SetEnvVarDto } from './dto/set-env-var.dto';

@Controller('apps/:appId/env')
@UseGuards(JwtAuthGuard)
export class EnvVarsController {
  constructor(private readonly envVarsService: EnvVarsService) {}

  @Post()
  set(@Param('appId') appId: string, @Body() dto: SetEnvVarDto) {
    return this.envVarsService.set(appId, dto);
  }

  @Get()
  findAll(@Param('appId') appId: string) {
    return this.envVarsService.findByApp(appId);
  }

  @Delete(':key')
  remove(@Param('appId') appId: string, @Param('key') key: string) {
    return this.envVarsService.remove(appId, key);
  }
}
