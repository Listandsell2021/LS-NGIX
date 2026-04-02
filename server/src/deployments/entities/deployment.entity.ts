import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { App } from '../../apps/entities/app.entity';

export enum DeploymentStatus {
  PENDING = 'pending',
  CLONING = 'cloning',
  INSTALLING = 'installing',
  BUILDING = 'building',
  STARTING = 'starting',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('deployments')
export class Deployment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => App, { onDelete: 'CASCADE' })
  app: App;

  @Column()
  appId: string;

  @Column({ type: 'varchar', default: DeploymentStatus.PENDING })
  status: DeploymentStatus;

  @Column({ nullable: true })
  commitHash: string;

  @Column({ nullable: true })
  commitMessage: string;

  @Column({ type: 'text', default: '' })
  log: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  finishedAt: Date;
}
