import { Injectable, Logger } from '@nestjs/common';
import { safeExec } from '../common/utils/safe-exec';

export interface ProcessInfo {
  name: string;
  status: string;
  cpu: string;
  memory: string;
  uptime: string;
}

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);

  async stop(name: string): Promise<string> {
    const result = await safeExec('npx', ['pm2', 'stop', name]);
    return result.stdout;
  }

  async restart(name: string): Promise<string> {
    const result = await safeExec('npx', ['pm2', 'restart', name]);
    return result.stdout;
  }

  async remove(name: string): Promise<string> {
    const result = await safeExec('npx', ['pm2', 'delete', name]);
    return result.stdout;
  }

  async status(name: string): Promise<ProcessInfo | null> {
    try {
      const result = await safeExec('npx', ['pm2', 'jlist']);
      const processes = JSON.parse(result.stdout);
      const proc = processes.find((p: any) => p.name === name);
      if (!proc) return null;
      return {
        name: proc.name,
        status: proc.pm2_env?.status || 'unknown',
        cpu: `${proc.monit?.cpu || 0}%`,
        memory: `${Math.round((proc.monit?.memory || 0) / 1024 / 1024)}MB`,
        uptime: proc.pm2_env?.pm_uptime
          ? `${Math.round((Date.now() - proc.pm2_env.pm_uptime) / 1000)}s`
          : '0s',
      };
    } catch {
      return null;
    }
  }

  async logs(name: string, lines = 50): Promise<string> {
    const result = await safeExec('npx', ['pm2', 'logs', name, '--lines', String(lines), '--nostream']);
    return result.stdout;
  }
}
