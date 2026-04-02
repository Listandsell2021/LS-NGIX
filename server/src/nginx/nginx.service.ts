import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';
import { safeExec } from '../common/utils/safe-exec';

@Injectable()
export class NginxService {
  private readonly logger = new Logger(NginxService.name);
  private readonly sitesAvailable = '/etc/nginx/sites-available';
  private readonly sitesEnabled = '/etc/nginx/sites-enabled';
  private httpTemplate: HandlebarsTemplateDelegate;
  private httpsTemplate: HandlebarsTemplateDelegate;

  constructor() {
    // Templates are copied to dist/ by nest-cli.json assets config
    const templatesDir = join(__dirname, 'templates');
    this.httpTemplate = Handlebars.compile(
      readFileSync(join(templatesDir, 'http.conf.hbs'), 'utf-8'),
    );
    this.httpsTemplate = Handlebars.compile(
      readFileSync(join(templatesDir, 'https.conf.hbs'), 'utf-8'),
    );
  }

  async createConfig(appSlug: string, domain: string, port: number, ssl = false): Promise<string> {
    const template = ssl ? this.httpsTemplate : this.httpTemplate;
    const config = template({ domain, port });
    const filename = `ls-ngix-${appSlug}-${domain.replace(/\./g, '-')}`;
    const configPath = join(this.sitesAvailable, filename);

    writeFileSync(configPath, config);
    this.logger.log(`Wrote Nginx config to ${configPath}`);

    const enabledPath = join(this.sitesEnabled, filename);
    await safeExec('ln', ['-sf', configPath, enabledPath], { sudo: true });

    const testResult = await this.testConfig();
    if (!testResult.valid) {
      await this.removeConfig(appSlug, domain);
      throw new Error(`Nginx config invalid: ${testResult.error}`);
    }

    await this.reload();
    return configPath;
  }

  async removeConfig(appSlug: string, domain: string): Promise<void> {
    const filename = `ls-ngix-${appSlug}-${domain.replace(/\./g, '-')}`;
    const configPath = join(this.sitesAvailable, filename);
    const enabledPath = join(this.sitesEnabled, filename);

    if (existsSync(enabledPath)) unlinkSync(enabledPath);
    if (existsSync(configPath)) unlinkSync(configPath);

    try { await this.reload(); } catch { /* ignore reload errors during cleanup */ }
  }

  async provisionSsl(domain: string, email: string): Promise<void> {
    await safeExec('certbot', [
      'certonly', '--nginx',
      '-d', domain,
      '--non-interactive',
      '--agree-tos',
      '-m', email,
    ], { sudo: true, timeout: 120_000 });
  }

  private async testConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      await safeExec('nginx', ['-t'], { sudo: true });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  private async reload(): Promise<void> {
    await safeExec('nginx', ['-s', 'reload'], { sudo: true });
  }
}
