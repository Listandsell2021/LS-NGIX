import { execFile, ExecFileException } from 'child_process';
import { spawn } from 'child_process';
import { Logger } from '@nestjs/common';

const logger = new Logger('SafeExec');

// Allowed commands — whitelist approach
const ALLOWED_COMMANDS = new Set([
  'git',
  'npm',
  'npx',
  'node',
  'yarn',
  'pnpm',
  'nginx',
  'certbot',
  'ln',
  'rm',
  'df',
  'pm2',
  'ssh-keygen',
  'ls',
  'cat',
]);

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Safe command execution using execFile (no shell interpretation).
 * Only allows whitelisted commands.
 * NEVER pass user input as the command — only as args.
 */
export function safeExec(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number; sudo?: boolean; env?: NodeJS.ProcessEnv } = {},
): Promise<ExecResult> {
  const baseCmd = command.split('/').pop() || command;

  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return Promise.reject(new Error(`Command "${baseCmd}" is not in the allowed list`));
  }

  const finalCmd = options.sudo ? 'sudo' : command;
  const finalArgs = options.sudo ? [command, ...args] : args;

  logger.debug(`Executing: ${finalCmd} ${finalArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    execFile(
      finalCmd,
      finalArgs,
      {
        cwd: options.cwd,
        timeout: options.timeout || 300_000, // 5 min default
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: options.env || { ...process.env },
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        const code = error?.code ? Number(error.code) : 0;
        if (error && !options.sudo) {
          reject(new Error(`Command failed (code ${code}): ${stderr || error.message}`));
        } else {
          resolve({ stdout, stderr, code });
        }
      },
    );
  });
}

/**
 * Safe command execution with live output streaming via callback.
 * Uses child_process.spawn (not exec) for streaming.
 */
export function safeSpawn(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    onOutput?: (data: string) => void;
    ignoreErrors?: boolean;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<void> {
  const baseCmd = command.split('/').pop() || command;

  if (!ALLOWED_COMMANDS.has(baseCmd)) {
    return Promise.reject(new Error(`Command "${baseCmd}" is not in the allowed list`));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      timeout: options.timeout || 300_000,
      env: options.env || { ...process.env },
    });

    child.stdout.on('data', (data: Buffer) => {
      options.onOutput?.(data.toString());
    });

    child.stderr.on('data', (data: Buffer) => {
      options.onOutput?.(data.toString());
    });

    child.on('close', (code: number) => {
      if (code !== 0 && !options.ignoreErrors) {
        reject(new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', (err: Error) => {
      if (!options.ignoreErrors) reject(err);
      else resolve();
    });
  });
}
