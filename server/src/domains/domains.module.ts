import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Domain } from './entities/domain.entity';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { AppsModule } from '../apps/apps.module';
import { NginxModule } from '../nginx/nginx.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Domain]), AppsModule, NginxModule, AuthModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
