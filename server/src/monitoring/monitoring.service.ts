import { Injectable } from '@nestjs/common';
import { cpus, totalmem, freemem, uptime, hostname } from 'os';
import { safeExec } from '../common/utils/safe-exec';

export interface SystemInfo {
  hostname: string;
  uptime: number;
  cpu: { model: string; cores: number; usage: number };
  memory: { total: number; used: number; free: number; percent: number };
  disk: { total: string; used: string; free: string; percent: string };
}

@Injectable()
export class MonitoringService {
  async getSystemInfo(): Promise<SystemInfo> {
    const cpuInfo = cpus();
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;
    const diskInfo = await this.getDiskUsage();

    return {
      hostname: hostname(),
      uptime: Math.round(uptime()),
      cpu: {
        model: cpuInfo[0]?.model || 'Unknown',
        cores: cpuInfo.length,
        usage: this.getCpuUsage(cpuInfo),
      },
      memory: {
        total: Math.round(totalMem / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024),
        percent: Math.round((usedMem / totalMem) * 100),
      },
      disk: diskInfo,
    };
  }

  private getCpuUsage(cpuInfo: ReturnType<typeof cpus>): number {
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpuInfo) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    return Math.round((1 - totalIdle / totalTick) * 100);
  }

  private async getDiskUsage(): Promise<{ total: string; used: string; free: string; percent: string }> {
    try {
      const result = await safeExec('df', ['-h', '/']);
      const lines = result.stdout.trim().split('\n');
      if (lines.length < 2) return { total: '?', used: '?', free: '?', percent: '?' };
      const parts = lines[1].split(/\s+/);
      return { total: parts[1] || '?', used: parts[2] || '?', free: parts[3] || '?', percent: parts[4] || '?' };
    } catch {
      return { total: '?', used: '?', free: '?', percent: '?' };
    }
  }
}
