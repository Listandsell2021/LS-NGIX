import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ssh_keys')
export class SshKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // user-friendly label like "GitHub Deploy Key"

  @Column({ type: 'text' })
  encryptedPrivateKey: string; // AES-256-GCM encrypted

  @Column({ type: 'text' })
  publicKey: string; // shown to user so they can add to GitHub

  @CreateDateColumn()
  createdAt: Date;
}
