import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

// NOTE: JwtAuthGuard will be added in Task 5 when auth module exists.
// For now, the controller has no guard — it will be updated in Task 5.

@Controller('audit')
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
