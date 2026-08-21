import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageAdapter } from './storage.interface';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local';
  private readonly baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /** Resolve key về đường dẫn tuyệt đối, CHẶN path-traversal (key phải nằm trong baseDir). */
  private resolveKey(key: string): string {
    const fullPath = path.resolve(this.baseDir, key);
    const rel = path.relative(this.baseDir, fullPath);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Invalid storage key (path traversal): ${key}`);
    }
    return fullPath;
  }

  async put(key: string, data: Buffer, _mimeType: string): Promise<string> {
    const fullPath = this.resolveKey(key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this.resolveKey(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.readFileSync(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveKey(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
