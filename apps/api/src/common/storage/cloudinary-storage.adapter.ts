import { Injectable, Logger } from '@nestjs/common';
import type { StorageAdapter } from './storage.interface';

/**
 * Phần API Cloudinary mà adapter dùng. Khai báo hẹp lại để test tiêm client giả
 * mà không phải dựng cả SDK.
 */
export interface CloudinaryClient {
  uploader: {
    upload_stream(
      options: Record<string, unknown>,
      callback: (error: unknown, result?: { public_id?: string }) => void,
    ): NodeJS.WritableStream;
    destroy(publicId: string, options: Record<string, unknown>): Promise<{ result?: string }>;
  };
  url(publicId: string, options: Record<string, unknown>): string;
}

/** Fetch tách ra thành tham số để test không chạm mạng thật. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/**
 * Lưu file trên Cloudinary NHƯNG vẫn giữ nguyên mô hình bảo mật của P7 (HANDOFF_P9 §A).
 *
 * Cloudinary mặc định là CDN CÔNG KHAI: upload kiểu thường thì ai có URL cũng tải được, phá
 * INVARIANT #5. Nên mọi upload ở đây đều là:
 *   - `resource_type: 'raw'`  — PDF không phải ảnh, đừng để Cloudinary xử lý như media
 *   - `type: 'authenticated'` — URL không chữ ký sẽ bị Cloudinary từ chối
 *
 * Và quan trọng không kém: adapter KHÔNG BAO GIỜ trả `secure_url` ra ngoài. `put` trả về đúng
 * `storageKey` do server sinh; client vẫn tải qua `GET /files/:id`, nơi `FilesService.ensureCanRead`
 * kiểm quyền. Cloudinary chỉ là chỗ chứa bytes, không phải đường phát hành.
 */
@Injectable()
export class CloudinaryStorageAdapter implements StorageAdapter {
  readonly provider = 'cloudinary';
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);

  constructor(
    private readonly client: CloudinaryClient,
    private readonly fetchFn: FetchLike = globalThis.fetch,
  ) {}

  /** Tuỳ chọn dùng CHUNG cho mọi thao tác — sai một chỗ là file thành công khai. */
  private options(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { resource_type: 'raw', type: 'authenticated', ...extra };
  }

  async put(key: string, data: Buffer, _mimeType: string): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      const stream = this.client.uploader.upload_stream(
        // public_id = storageKey để ánh xạ 1-1; raw giữ nguyên cả phần đuôi file.
        this.options({ public_id: key, overwrite: true, invalidate: true }),
        (error) => (error ? reject(toError(error, `Upload thất bại: ${key}`)) : resolve()),
      );
      stream.end(data);
    });
    // Trả KEY, không trả URL Cloudinary (§A).
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const signedUrl = this.client.url(key, this.options({ sign_url: true, secure: true }));
    const res = await this.fetchFn(signedUrl);
    if (!res.ok) {
      throw new Error(`File not found: ${key} (Cloudinary trả ${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.uploader.destroy(key, this.options());
    // 'not found' coi như đã xoá — delete phải idempotent.
    if (res.result && res.result !== 'ok' && res.result !== 'not found') {
      this.logger.warn(`Xoá file trên Cloudinary không thành công: ${key} -> ${res.result}`);
    }
  }
}

function toError(cause: unknown, message: string): Error {
  return cause instanceof Error ? cause : new Error(`${message}: ${String(cause)}`);
}
