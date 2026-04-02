import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppsService } from './apps.service';
import { AppsController } from './apps.controller';
import { AuthModule } from '../auth/auth.module';
import { SshKeysModule } from '../ssh-keys/ssh-keys.module';

@Module({
  imports: [TypeOrmModule.forFeature([App]), AuthModule, SshKeysModule],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
