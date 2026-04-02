import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { App } from '../../apps/entities/app.entity';

@Entity('domains')
export class Domain {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => App, { onDelete: 'CASCADE' })
  app: App;

  @Column()
  appId: string;

  @Column()
  domain: string;

  @Column({ default: false })
  sslEnabled: boolean;

  @Column({ nullable: true })
  nginxConfigPath: string;

  @CreateDateColumn()
  createdAt: Date;
}
