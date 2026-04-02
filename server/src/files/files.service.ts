import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'fs';
import { join, resolve, extname } from 'path';
import { AppsService } from '../apps/apps.service';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

// Binary/large file extensions that should not be read as text
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.webm',
  '.exe', '.dll', '.so', '.dylib',
  '.sqlite', '.sqlite-journal', '.db',
]);

// Max file size to read (2MB)
const MAX_READ_SIZE = 2 * 1024 * 1024;

@Injectable()
export class FilesService {
  constructor(private readonly appsService: AppsService) {}

  private async getAppDir(appId: string): Promise<string> {
    const app = await this.appsService.findOne(appId);
    const appsDir = process.env.APPS_DIR || join(__dirname, '..', '..', 'managed-apps');
    const appDir = join(appsDir, app.slug, 'source');

    if (!existsSync(appDir)) {
      throw new NotFoundException('App source directory not found. Deploy the app first.');
    }

    return appDir;
  }

  /**
   * Resolve a relative path within the app directory.
   * Prevents path traversal attacks.
   */
  private safePath(baseDir: string, relativePath: string): string {
    const resolved = resolve(baseDir, relativePath);

    // Prevent path traversal: resolved path must start with base directory
    if (!resolved.startsWith(baseDir)) {
      throw new BadRequestException('Invalid path: cannot access files outside app directory');
    }

    return resolved;
  }

  async listFiles(appId: string, relativePath: string): Promise<{ path: string; entries: FileEntry[] }> {
    const baseDir = await this.getAppDir(appId);
    const targetDir = this.safePath(baseDir, relativePath);

    if (!existsSync(targetDir)) {
      throw new NotFoundException(`Directory not found: ${relativePath}`);
    }

    const stat = statSync(targetDir);
    if (!stat.isDirectory()) {
      throw new BadRequestException('Path is not a directory');
    }

    const entries: FileEntry[] = [];

    for (const name of readdirSync(targetDir)) {
      // Skip node_modules and .git — too large to browse
      if (name === 'node_modules' || name === '.git') continue;

      try {
        const fullPath = join(targetDir, name);
        const itemStat = statSync(fullPath);
        const entryRelPath = relativePath ? `${relativePath}/${name}` : name;

        entries.push({
          name,
          path: entryRelPath,
          type: itemStat.isDirectory() ? 'directory' : 'file',
          size: itemStat.size,
          modifiedAt: itemStat.mtime.toISOString(),
        });
      } catch {
        // Skip files we can't stat (e.g., broken symlinks)
      }
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { path: relativePath || '.', entries };
  }

  async readFile(appId: string, relativePath: string): Promise<{ path: string; content: string; size: number; binary: boolean }> {
    const baseDir = await this.getAppDir(appId);
    const fullPath = this.safePath(baseDir, relativePath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException(`File not found: ${relativePath}`);
    }

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      throw new BadRequestException('Cannot read a directory');
    }

    const ext = extname(fullPath).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      return { path: relativePath, content: '', size: stat.size, binary: true };
    }

    if (stat.size > MAX_READ_SIZE) {
      return {
        path: relativePath,
        content: `File too large to display (${(stat.size / 1024 / 1024).toFixed(1)}MB). Use the terminal to edit.`,
        size: stat.size,
        binary: false,
      };
    }

    const content = readFileSync(fullPath, 'utf-8');
    return { path: relativePath, content, size: stat.size, binary: false };
  }

  async writeFile(appId: string, relativePath: string, content: string): Promise<{ message: string }> {
    const baseDir = await this.getAppDir(appId);
    const fullPath = this.safePath(baseDir, relativePath);

    // Don't allow writing to certain paths
    if (relativePath.includes('node_modules') || relativePath.includes('.git')) {
      throw new BadRequestException('Cannot write to node_modules or .git directories');
    }

    writeFileSync(fullPath, content, 'utf-8');
    return { message: `File saved: ${relativePath}` };
  }

  async createFolder(appId: string, relativePath: string): Promise<{ message: string }> {
    const baseDir = await this.getAppDir(appId);
    const fullPath = this.safePath(baseDir, relativePath);

    if (existsSync(fullPath)) {
      throw new BadRequestException('Path already exists');
    }

    mkdirSync(fullPath, { recursive: true });
    return { message: `Folder created: ${relativePath}` };
  }

  async deleteFile(appId: string, relativePath: string): Promise<{ message: string }> {
    const baseDir = await this.getAppDir(appId);
    const fullPath = this.safePath(baseDir, relativePath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException(`Not found: ${relativePath}`);
    }

    // Don't allow deleting critical files
    if (relativePath === '' || relativePath === '.' || relativePath === '/') {
      throw new BadRequestException('Cannot delete root directory');
    }

    if (relativePath.includes('node_modules') || relativePath.includes('.git')) {
      throw new BadRequestException('Cannot delete node_modules or .git');
    }

    rmSync(fullPath, { recursive: true });
    return { message: `Deleted: ${relativePath}` };
  }
}
