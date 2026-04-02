import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { ProcessManagerService } from './process-manager.service';

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
}
