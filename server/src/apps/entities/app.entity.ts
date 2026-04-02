import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppStatus {
  STOPPED = 'stopped',
  RUNNING = 'running',
  BUILDING = 'building',
  ERRORED = 'errored',
}

@Entity('apps')
export class App {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  gitUrl: string;

  @Column({ default: 'main' })
  gitBranch: string;

  @Column({ default: 'npm install' })
  installCommand: string;

  @Column({ default: 'npm run build' })
  buildCommand: string;

  @Column({ default: 'npm run start:prod' })
  startCommand: string;

  @Column({ type: 'int' })
  port: number;

  @Column({ type: 'varchar', default: AppStatus.STOPPED })
  status: AppStatus;

  @Column({ nullable: true })
  sshKeyId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
