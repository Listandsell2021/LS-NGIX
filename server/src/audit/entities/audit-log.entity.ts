import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string; // 'auth.login', 'app.create', 'app.deploy', 'domain.add', etc.

  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true })
  appId: string;

  @Column()
  ip: string;

  @Column({ type: 'text', nullable: true })
  details: string; // JSON string with extra context

  @Column()
  method: string; // GET, POST, DELETE, etc.

  @Column()
  path: string; // /api/apps/xxx/deploy

  @Column({ nullable: true })
  statusCode: number;

  @CreateDateColumn()
  createdAt: Date;
}
