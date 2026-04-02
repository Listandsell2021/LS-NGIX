import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { safeSpawn } from '../common/utils/safe-exec';
import { ChildProcess, spawn } from 'child_process';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LogsGateway.name);
  private activeStreams = new Map<string, ChildProcess>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    // Verify JWT on WebSocket connection
    const token = client.handshake.auth?.token ||
      client.handshake.headers?.cookie?.match(/access_token=([^;]+)/)?.[1];

    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: no token`);
      client.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token, { secret: this.authService.getJwtSecret() });
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe-logs')
  handleSubscribe(client: Socket, payload: { appSlug: string }) {
    const { appSlug } = payload;
    this.logger.log(`Client ${client.id} subscribing to logs for ${appSlug}`);

    this.killStream(client.id);

    const child = spawn('npx', ['pm2', 'logs', appSlug, '--raw'], {
      env: { ...process.env },
    });

    this.activeStreams.set(client.id, child);

    child.stdout.on('data', (data: Buffer) => {
      client.emit('log-line', { type: 'stdout', data: data.toString() });
    });

    child.stderr.on('data', (data: Buffer) => {
      client.emit('log-line', { type: 'stderr', data: data.toString() });
    });

    child.on('close', () => {
      this.activeStreams.delete(client.id);
    });
  }

  @SubscribeMessage('unsubscribe-logs')
  handleUnsubscribe(client: Socket) {
    this.killStream(client.id);
  }

  handleDisconnect(client: Socket) {
    this.killStream(client.id);
  }

  private killStream(clientId: string) {
    const child = this.activeStreams.get(clientId);
    if (child) {
      child.kill();
      this.activeStreams.delete(clientId);
    }
  }

  broadcastDeploymentLog(appId: string, line: string) {
    this.server.emit(`deployment-log-${appId}`, { data: line });
  }
}
