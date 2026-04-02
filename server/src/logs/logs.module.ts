import { Module } from '@nestjs/common';
import { LogsGateway } from './logs.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [LogsGateway],
  exports: [LogsGateway],
})
export class LogsModule {}
