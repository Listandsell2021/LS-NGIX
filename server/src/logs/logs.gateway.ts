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
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import * as pty from 'node-pty';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LogsGateway.name);
  private activeStreams = new Map<string, ChildProcess>();
  private activeTerminals = new Map<string, pty.IPty>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
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

  // ─── PM2 Log Streaming ───────────────────────────

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

  // ─── Interactive Terminal ─────────────────────────

  @SubscribeMessage('terminal-start')
  handleTerminalStart(client: Socket, payload: { appSlug?: string; cols?: number; rows?: number }) {
    this.logger.log(`Client ${client.id} starting terminal session`);

    this.killTerminal(client.id);

    // Determine working directory
    const appsDir = process.env.APPS_DIR || join(__dirname, '..', '..', 'managed-apps');
    let cwd = appsDir;

    if (payload.appSlug) {
      const appDir = join(appsDir, payload.appSlug, 'source');
      if (existsSync(appDir)) {
        cwd = appDir;
      }
    }

    const shell = process.env.SHELL || '/bin/bash';
    const cols = payload.cols || 80;
    const rows = payload.rows || 24;

    const term = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: { ...process.env } as Record<string, string>,
    });

    this.activeTerminals.set(client.id, term);

    term.onData((data: string) => {
      client.emit('terminal-output', data);
    });

    term.onExit(({ exitCode }) => {
      this.activeTerminals.delete(client.id);
      client.emit('terminal-exit', { code: exitCode });
    });

    client.emit('terminal-ready');
  }

  @SubscribeMessage('terminal-input')
  handleTerminalInput(client: Socket, payload: { data: string }) {
    const terminal = this.activeTerminals.get(client.id);
    if (terminal) {
      terminal.write(payload.data);
    }
  }

  @SubscribeMessage('terminal-resize')
  handleTerminalResize(client: Socket, payload: { cols: number; rows: number }) {
    const terminal = this.activeTerminals.get(client.id);
    if (terminal) {
      terminal.resize(payload.cols, payload.rows);
    }
  }

  @SubscribeMessage('terminal-stop')
  handleTerminalStop(client: Socket) {
    this.killTerminal(client.id);
  }

  // ─── Cleanup ──────────────────────────────────────

  handleDisconnect(client: Socket) {
    this.killStream(client.id);
    this.killTerminal(client.id);
  }

  private killStream(clientId: string) {
    const child = this.activeStreams.get(clientId);
    if (child) {
      child.kill();
      this.activeStreams.delete(clientId);
    }
  }

  private killTerminal(clientId: string) {
    const term = this.activeTerminals.get(clientId);
    if (term) {
      term.kill();
      this.activeTerminals.delete(clientId);
    }
  }

  broadcastDeploymentLog(appId: string, line: string) {
    this.server.emit(`deployment-log-${appId}`, { data: line });
  }
}
