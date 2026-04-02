import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { DeploymentsService } from './deployments.service';

@Controller('apps/:appId/deployments')
@UseGuards(JwtAuthGuard)
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  deploy(@Param('appId') appId: string) {
    return this.deploymentsService.deploy(appId);
  }

  @Get()
  findAll(@Param('appId') appId: string) {
    return this.deploymentsService.findByApp(appId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deploymentsService.findOne(Number(id));
  }
}
