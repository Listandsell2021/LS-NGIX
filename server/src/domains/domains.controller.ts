import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';

@Controller('apps/:appId/domains')
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  create(@Param('appId') appId: string, @Body() dto: CreateDomainDto) {
    return this.domainsService.create(appId, dto);
  }

  @Get()
  findAll(@Param('appId') appId: string) {
    return this.domainsService.findByApp(appId);
  }

  @Post(':domainId/ssl')
  enableSsl(@Param('domainId') domainId: string, @Body('email') email: string) {
    return this.domainsService.enableSsl(Number(domainId), email);
  }

  @Delete(':domainId')
  remove(@Param('domainId') domainId: string) {
    return this.domainsService.remove(Number(domainId));
  }
}
