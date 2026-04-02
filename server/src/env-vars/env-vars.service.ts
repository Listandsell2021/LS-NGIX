import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EnvVar } from './entities/env-var.entity';
import { SetEnvVarDto } from './dto/set-env-var.dto';

@Injectable()
export class EnvVarsService {
  private encryptionKey: Buffer;

  constructor(
    @InjectRepository(EnvVar)
    private readonly envVarRepo: Repository<EnvVar>,
  ) {
    this.encryptionKey = this.loadOrCreateKey();
  }

  private loadOrCreateKey(): Buffer {
    const keyPath = join(__dirname, '..', '..', 'data', 'encryption.key');
    if (existsSync(keyPath)) {
      return Buffer.from(readFileSync(keyPath, 'utf-8'), 'hex');
    }
    const key = randomBytes(32);
    writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
    return key;
  }

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  private decrypt(data: string): string {
    const [ivHex, tagHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }

  async set(appId: string, dto: SetEnvVarDto): Promise<{ key: string }> {
    let envVar = await this.envVarRepo.findOne({ where: { appId, key: dto.key } });
    const encryptedValue = this.encrypt(dto.value);

    if (envVar) {
      envVar.encryptedValue = encryptedValue;
    } else {
      envVar = this.envVarRepo.create({ appId, key: dto.key, encryptedValue });
    }

    await this.envVarRepo.save(envVar);
    return { key: dto.key };
  }

  async findByApp(appId: string): Promise<{ key: string; masked: string }[]> {
    const vars = await this.envVarRepo.find({ where: { appId } });
    return vars.map((v) => ({ key: v.key, masked: '********' }));
  }

  async remove(appId: string, key: string): Promise<void> {
    const envVar = await this.envVarRepo.findOne({ where: { appId, key } });
    if (!envVar) throw new NotFoundException(`Env var "${key}" not found`);
    await this.envVarRepo.remove(envVar);
  }

  async writeEnvFile(appId: string, destPath: string): Promise<void> {
    const vars = await this.envVarRepo.find({ where: { appId } });
    const lines = vars.map((v) => `${v.key}=${this.decrypt(v.encryptedValue)}`);
    writeFileSync(destPath, lines.join('\n') + '\n', { mode: 0o600 });
  }
}
