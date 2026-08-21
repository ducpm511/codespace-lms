export interface StorageAdapter {
  /** Tên driver, ghi vào `File.provider` để biết bytes nằm ở đâu khi cần đối soát/di trú. */
  readonly provider: string;
  /** Trả về storageKey (KHÔNG phải URL) — file private chỉ phát qua `GET /files/:id`. */
  put(key: string, data: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';
