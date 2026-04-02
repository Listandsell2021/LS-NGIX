import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deployment } from './entities/deployment.entity';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { AppsModule } from '../apps/apps.module';
import { AuthModule } from '../auth/auth.module';
import { SshKeysModule } from '../ssh-keys/ssh-keys.module';

@Module({
  imports: [TypeOrmModule.forFeature([Deployment]), AppsModule, AuthModule, SshKeysModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
