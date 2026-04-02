import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Domain } from './entities/domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';
import { AppsService } from '../apps/apps.service';
import { NginxService } from '../nginx/nginx.service';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(Domain)
    private readonly domainRepo: Repository<Domain>,
    private readonly appsService: AppsService,
    private readonly nginxService: NginxService,
  ) {}

  async create(appId: string, dto: CreateDomainDto): Promise<Domain> {
    const app = await this.appsService.findOne(appId);
    const existing = await this.domainRepo.findOne({ where: { domain: dto.domain } });
    if (existing) throw new ConflictException(`Domain "${dto.domain}" is already configured`);

    const configPath = await this.nginxService.createConfig(app.slug, dto.domain, app.port);
    const domain = this.domainRepo.create({ appId: app.id, domain: dto.domain, nginxConfigPath: configPath });
    return this.domainRepo.save(domain);
  }

  async findByApp(appId: string): Promise<Domain[]> {
    return this.domainRepo.find({ where: { appId } });
  }

  async enableSsl(domainId: number, email: string): Promise<Domain> {
    const domain = await this.domainRepo.findOne({ where: { id: domainId }, relations: ['app'] });
    if (!domain) throw new NotFoundException('Domain not found');

    await this.nginxService.provisionSsl(domain.domain, email);
    await this.nginxService.createConfig(domain.app.slug, domain.domain, domain.app.port, true);

    domain.sslEnabled = true;
    return this.domainRepo.save(domain);
  }

  async remove(domainId: number): Promise<void> {
    const domain = await this.domainRepo.findOne({ where: { id: domainId }, relations: ['app'] });
    if (!domain) throw new NotFoundException('Domain not found');
    await this.nginxService.removeConfig(domain.app.slug, domain.domain);
    await this.domainRepo.remove(domain);
  }
}
