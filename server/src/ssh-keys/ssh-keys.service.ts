import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SshKey } from './entities/ssh-key.entity';
import { CreateSshKeyDto } from './dto/create-ssh-key.dto';
import { safeExec } from '../common/utils/safe-exec';

@Injectable()
export class SshKeysService {
  private encryptionKey: Buffer;

  constructor(
    @InjectRepository(SshKey)
    private readonly sshKeyRepo: Repository<SshKey>,
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

  async generate(dto: CreateSshKeyDto): Promise<{ id: number; name: string; publicKey: string }> {
    let privateKey: string;
    let publicKey: string;

    if (dto.privateKey) {
      // Import existing key
      privateKey = dto.privateKey;
      // Write temp file to extract public key
      const tmpPath = join(__dirname, '..', '..', 'data', `tmp-key-${Date.now()}`);
      writeFileSync(tmpPath, privateKey, { mode: 0o600 });
      try {
        const result = await safeExec('ssh-keygen', ['-y', '-f', tmpPath]);
        publicKey = result.stdout.trim();
      } finally {
        const fs = require('fs');
        fs.unlinkSync(tmpPath);
      }
    } else {
      // Generate new key pair
      const tmpPath = join(__dirname, '..', '..', 'data', `tmp-key-${Date.now()}`);
      await safeExec('ssh-keygen', [
        '-t', 'ed25519',
        '-f', tmpPath,
        '-N', '', // no passphrase
        '-C', `ls-ngix-${dto.name}`,
      ]);
      privateKey = readFileSync(tmpPath, 'utf-8');
      publicKey = readFileSync(`${tmpPath}.pub`, 'utf-8').trim();
      // Clean up temp files
      const fs = require('fs');
      fs.unlinkSync(tmpPath);
      fs.unlinkSync(`${tmpPath}.pub`);
    }

    const sshKey = this.sshKeyRepo.create({
      name: dto.name,
      encryptedPrivateKey: this.encrypt(privateKey),
      publicKey,
    });
    await this.sshKeyRepo.save(sshKey);

    return { id: sshKey.id, name: sshKey.name, publicKey: sshKey.publicKey };
  }

  async findAll(): Promise<{ id: number; name: string; publicKey: string; createdAt: Date }[]> {
    const keys = await this.sshKeyRepo.find({ order: { createdAt: 'DESC' } });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      publicKey: k.publicKey,
      createdAt: k.createdAt,
    }));
  }

  async findOne(id: number): Promise<SshKey> {
    const key = await this.sshKeyRepo.findOne({ where: { id } });
    if (!key) throw new NotFoundException(`SSH key with id ${id} not found`);
    return key;
  }

  async remove(id: number): Promise<void> {
    const key = await this.findOne(id);
    await this.sshKeyRepo.remove(key);
  }

  /**
   * Write the private key to a temp file for git to use via GIT_SSH_COMMAND.
   * Returns the path. Caller must delete the file after use.
   */
  async writeKeyToTempFile(id: number): Promise<string> {
    const key = await this.findOne(id);
    const privateKey = this.decrypt(key.encryptedPrivateKey);
    const tmpPath = join(__dirname, '..', '..', 'data', `deploy-key-${id}-${Date.now()}`);
    writeFileSync(tmpPath, privateKey, { mode: 0o600 });
    return tmpPath;
  }
}
