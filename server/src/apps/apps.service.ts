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
