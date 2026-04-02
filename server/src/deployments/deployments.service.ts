import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Deployment, DeploymentStatus } from './entities/deployment.entity';
import { AppsService } from '../apps/apps.service';
import { AppStatus } from '../apps/entities/app.entity';
import { safeSpawn, safeExec } from '../common/utils/safe-exec';
import { SshKeysService } from '../ssh-keys/ssh-keys.service';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);
  private readonly appsDir: string;

  constructor(
    @InjectRepository(Deployment)
    private readonly deployRepo: Repository<Deployment>,
    private readonly appsService: AppsService,
    private readonly sshKeysService: SshKeysService,
  ) {
    this.appsDir = process.env.APPS_DIR || join(__dirname, '..', '..', 'managed-apps');
    if (!existsSync(this.appsDir)) {
      mkdirSync(this.appsDir, { recursive: true });
    }
  }

  async deploy(appId: string): Promise<Deployment> {
    const app = await this.appsService.findOne(appId);
    const deployment = this.deployRepo.create({ appId: app.id, status: DeploymentStatus.PENDING });
    await this.deployRepo.save(deployment);

    // Run async — don't block the response
    this.runPipeline(deployment.id, app.id).catch((err) => {
      this.logger.error(`Deployment ${deployment.id} failed: ${err.message}`);
    });

    return deployment;
  }

  private async runPipeline(deploymentId: number, appId: string): Promise<void> {
    const app = await this.appsService.findOne(appId);
    const appDir = join(this.appsDir, app.slug, 'source');

    let keyPath: string | null = null;
    let gitEnv: NodeJS.ProcessEnv = { ...process.env };

    try {
      // Set up SSH key environment if configured
      if (app.sshKeyId) {
        keyPath = await this.sshKeysService.writeKeyToTempFile(app.sshKeyId);
        gitEnv = {
          ...process.env,
          GIT_SSH_COMMAND: `ssh -i ${keyPath} -o StrictHostKeyChecking=no`,
        };
      }

      // Clone or pull
      await this.updateStatus(deploymentId, DeploymentStatus.CLONING);
      await this.appsService.updateStatus(appId, AppStatus.BUILDING);

      if (existsSync(appDir)) {
        await this.appendLog(deploymentId, '> git fetch origin\n');
        await safeSpawn('git', ['fetch', 'origin'], {
          cwd: appDir,
          env: gitEnv,
          onOutput: (line) => this.appendLog(deploymentId, line),
        });
        await this.appendLog(deploymentId, `> git reset --hard origin/${app.gitBranch}\n`);
        await safeSpawn('git', ['reset', '--hard', `origin/${app.gitBranch}`], {
          cwd: appDir,
          env: gitEnv,
          onOutput: (line) => this.appendLog(deploymentId, line),
        });
      } else {
        const parentDir = join(this.appsDir, app.slug);
        if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
        await this.appendLog(deploymentId, `> git clone ${app.gitUrl} -b ${app.gitBranch}\n`);
        await safeSpawn('git', ['clone', app.gitUrl, '-b', app.gitBranch, appDir], {
          cwd: this.appsDir,
          env: gitEnv,
          onOutput: (line) => this.appendLog(deploymentId, line),
        });
      }

      // Get commit info
      const hashResult = await safeExec('git', ['rev-parse', '--short', 'HEAD'], { cwd: appDir });
      const msgResult = await safeExec('git', ['log', '-1', '--pretty=%s'], { cwd: appDir });
      await this.deployRepo.update(deploymentId, {
        commitHash: hashResult.stdout.trim(),
        commitMessage: msgResult.stdout.trim(),
      });

      // Install
      if (app.installCommand) {
        await this.updateStatus(deploymentId, DeploymentStatus.INSTALLING);
        const installParts = app.installCommand.split(' ');
        await this.appendLog(deploymentId, `\n> ${app.installCommand}\n`);
        await safeSpawn(installParts[0], installParts.slice(1), {
          cwd: appDir,
          onOutput: (line) => this.appendLog(deploymentId, line),
        });
      } else {
        await this.appendLog(deploymentId, '\n> Skipping install (no command configured)\n');
      }

      // Build
      if (app.buildCommand) {
        await this.updateStatus(deploymentId, DeploymentStatus.BUILDING);
        const buildParts = app.buildCommand.split(' ');
        await this.appendLog(deploymentId, `\n> ${app.buildCommand}\n`);
        await safeSpawn(buildParts[0], buildParts.slice(1), {
          cwd: appDir,
          onOutput: (line) => this.appendLog(deploymentId, line),
        });
      } else {
        await this.appendLog(deploymentId, '\n> Skipping build (no command configured)\n');
      }

      // Start via PM2
      await this.updateStatus(deploymentId, DeploymentStatus.STARTING);
      await this.appendLog(deploymentId, '\n> Starting app with PM2...\n');

      // Delete existing PM2 process (ignore errors if not found)
      await safeSpawn('npx', ['pm2', 'delete', app.slug], {
        cwd: appDir,
        ignoreErrors: true,
        onOutput: (line) => this.appendLog(deploymentId, line),
      });

      // Start new process
      // For "npm start" / "npm run X" → pm2 start npm --name X --cwd Y -- start / run X
      // For "node server.js" → pm2 start server.js --name X --cwd Y
      const startParts = app.startCommand.split(' ');
      let pm2Args: string[];

      if (['npm', 'npx', 'yarn', 'pnpm'].includes(startParts[0])) {
        pm2Args = ['pm2', 'start', startParts[0], '--name', app.slug, '--cwd', appDir, '--', ...startParts.slice(1)];
      } else if (startParts[0] === 'node') {
        pm2Args = ['pm2', 'start', ...startParts.slice(1), '--name', app.slug, '--cwd', appDir];
      } else {
        pm2Args = ['pm2', 'start', startParts[startParts.length - 1], '--name', app.slug, '--cwd', appDir];
      }

      await this.appendLog(deploymentId, `> npx ${pm2Args.join(' ')}\n`);
      await safeSpawn('npx', pm2Args, {
        cwd: appDir,
        onOutput: (line) => this.appendLog(deploymentId, line),
      });

      await this.appendLog(deploymentId, '\n--- Deployment successful ---\n');
      await this.updateStatus(deploymentId, DeploymentStatus.SUCCESS);
      await this.appsService.updateStatus(appId, AppStatus.RUNNING);
      await this.deployRepo.update(deploymentId, { finishedAt: new Date() });
    } catch (err: any) {
      await this.appendLog(deploymentId, `\n--- FAILED: ${err.message} ---\n`);
      await this.updateStatus(deploymentId, DeploymentStatus.FAILED);
      await this.appsService.updateStatus(appId, AppStatus.ERRORED);
      await this.deployRepo.update(deploymentId, { finishedAt: new Date() });
    } finally {
      if (keyPath) {
        try { require('fs').unlinkSync(keyPath); } catch {}
      }
    }
  }

  private async appendLog(deploymentId: number, text: string): Promise<void> {
    await this.deployRepo
      .createQueryBuilder()
      .update(Deployment)
      .set({ log: () => `log || '${text.replace(/'/g, "''")}'` })
      .where('id = :id', { id: deploymentId })
      .execute();
  }

  private async updateStatus(deploymentId: number, status: DeploymentStatus): Promise<void> {
    await this.deployRepo.update(deploymentId, { status });
  }

  async findByApp(appId: string): Promise<Deployment[]> {
    return this.deployRepo.find({
      where: { appId },
      order: { startedAt: 'DESC' },
      take: 20,
    });
  }

  async findOne(id: number): Promise<Deployment | null> {
    return this.deployRepo.findOne({ where: { id } });
  }
}
