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
