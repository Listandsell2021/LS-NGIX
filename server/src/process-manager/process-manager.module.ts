import { Module } from '@nestjs/common';
import { ProcessManagerService } from './process-manager.service';
import { ProcessManagerController } from './process-manager.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProcessManagerController],
  providers: [ProcessManagerService],
  exports: [ProcessManagerService],
})
export class ProcessManagerModule {}
