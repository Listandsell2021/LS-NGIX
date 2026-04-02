import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AppsModule } from './apps/apps.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ProcessManagerModule } from './process-manager/process-manager.module';
import { NginxModule } from './nginx/nginx.module';
import { DomainsModule } from './domains/domains.module';
import { EnvVarsModule } from './env-vars/env-vars.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { LogsModule } from './logs/logs.module';
import { SshKeysModule } from './ssh-keys/ssh-keys.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(__dirname, '..', 'data', 'ls-ngix.sqlite'),
      autoLoadEntities: true,
      synchronize: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'client', 'dist'),
      exclude: ['/api/(.*)'],
    }),
    AuditModule,
    AuthModule,
    AppsModule,
    DeploymentsModule,
    ProcessManagerModule,
    NginxModule,
    DomainsModule,
    EnvVarsModule,
    MonitoringModule,
    LogsModule,
    SshKeysModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
