import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvVar } from './entities/env-var.entity';
import { EnvVarsService } from './env-vars.service';
import { EnvVarsController } from './env-vars.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([EnvVar]), AuthModule],
  controllers: [EnvVarsController],
  providers: [EnvVarsService],
  exports: [EnvVarsService],
})
export class EnvVarsModule {}
