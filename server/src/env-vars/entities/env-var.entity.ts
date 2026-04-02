import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { App } from '../../apps/entities/app.entity';

@Entity('env_vars')
export class EnvVar {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => App, { onDelete: 'CASCADE' })
  app: App;

  @Column()
  appId: string;

  @Column()
  key: string;

  @Column({ type: 'text' })
  encryptedValue: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
