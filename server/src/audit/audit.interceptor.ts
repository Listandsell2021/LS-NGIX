import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, ip } = request;

    // Only log mutating requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.auditService.log({
            action: this.deriveAction(method, originalUrl),
            userId: user?.id,
            ip: ip || request.headers['x-forwarded-for'] || 'unknown',
            method,
            path: originalUrl,
            statusCode: response.statusCode,
            details: JSON.stringify({
              duration: Date.now() - startTime,
            }),
          });
        },
        error: (error) => {
          this.auditService.log({
            action: this.deriveAction(method, originalUrl),
            userId: user?.id,
            ip: ip || request.headers['x-forwarded-for'] || 'unknown',
            method,
            path: originalUrl,
            statusCode: error.status || 500,
            details: JSON.stringify({
              error: error.message,
              duration: Date.now() - startTime,
            }),
          });
        },
      }),
    );
  }

  private deriveAction(method: string, url: string): string {
    const parts = url.replace('/api/', '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[parts.length - 1]}`;
    }
    return `${method.toLowerCase()}.${parts[0] || 'unknown'}`;
  }
}
