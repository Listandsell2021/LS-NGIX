import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AppsModule } from '../apps/apps.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AppsModule, AuthModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
