export interface StorageAdapter {
  put(key: string, data: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';
