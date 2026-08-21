import { Writable } from 'stream';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import type { CloudinaryClient, FetchLike } from './cloudinary-storage.adapter';

/** Thu lại options + bytes mà adapter gửi cho Cloudinary. */
function makeClient() {
  const uploads: { options: Record<string, unknown>; body: Buffer }[] = [];
  const urlCalls: { publicId: string; options: Record<string, unknown> }[] = [];
  const destroyCalls: { publicId: string; options: Record<string, unknown> }[] = [];
  let uploadError: unknown = null;
  let destroyResult: { result?: string } = { result: 'ok' };

  const client: CloudinaryClient = {
    uploader: {
      upload_stream(options, callback) {
        const chunks: Buffer[] = [];
        return new Writable({
          write(chunk: Buffer, _enc, next) {
            chunks.push(chunk);
            next();
          },
          final(next) {
            uploads.push({ options, body: Buffer.concat(chunks) });
            callback(uploadError, { public_id: String(options.public_id) });
            next();
          },
        });
      },
      destroy(publicId, options) {
        destroyCalls.push({ publicId, options });
        return Promise.resolve(destroyResult);
      },
    },
    url(publicId, options) {
      urlCalls.push({ publicId, options });
      return `https://res.cloudinary.com/demo/raw/authenticated/s--SIGNED--/${publicId}`;
    },
  };

  return {
    client,
    uploads,
    urlCalls,
    destroyCalls,
    failUpload: (err: unknown) => (uploadError = err),
    setDestroyResult: (r: { result?: string }) => (destroyResult = r),
  };
}

function makeFetch(body: Buffer, ok = true, status = 200): FetchLike {
  return () =>
    Promise.resolve({
      ok,
      status,
      arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer),
    });
}

const KEY = 'lesson-files/9f2c-4b1e.pdf';
const PDF = Buffer.from('%PDF-1.7 noi dung bai giang');

describe('CloudinaryStorageAdapter', () => {
  let mock: ReturnType<typeof makeClient>;
  let adapter: CloudinaryStorageAdapter;

  beforeEach(() => {
    mock = makeClient();
    adapter = new CloudinaryStorageAdapter(mock.client, makeFetch(PDF));
  });

  describe('file phải PRIVATE (HANDOFF_P9 §A / INVARIANT #5)', () => {
    it('upload luôn dùng resource_type=raw + type=authenticated', async () => {
      await adapter.put(KEY, PDF, 'application/pdf');

      expect(mock.uploads).toHaveLength(1);
      expect(mock.uploads[0].options).toMatchObject({
        resource_type: 'raw',
        type: 'authenticated',
        public_id: KEY,
      });
    });

    it('KHÔNG upload kiểu công khai (type=upload) — đó là cách file lọt ra CDN', async () => {
      await adapter.put(KEY, PDF, 'application/pdf');
      expect(mock.uploads[0].options.type).not.toBe('upload');
    });

    it('put trả về storageKey, KHÔNG trả URL Cloudinary ra ngoài', async () => {
      const result = await adapter.put(KEY, PDF, 'application/pdf');

      expect(result).toBe(KEY);
      expect(result).not.toContain('cloudinary');
      expect(result).not.toContain('http');
    });

    it('đọc file phải qua URL CÓ CHỮ KÝ — URL thô không tải được', async () => {
      await adapter.get(KEY);

      expect(mock.urlCalls).toHaveLength(1);
      expect(mock.urlCalls[0]).toEqual({
        publicId: KEY,
        options: { resource_type: 'raw', type: 'authenticated', sign_url: true, secure: true },
      });
    });

    it('URL thô (Cloudinary từ chối vì thiếu chữ ký) -> ném lỗi, không trả nội dung rỗng', async () => {
      const denied = new CloudinaryStorageAdapter(mock.client, makeFetch(Buffer.alloc(0), false, 401));
      await expect(denied.get(KEY)).rejects.toThrow(/401/);
    });
  });

  describe('đọc/ghi', () => {
    it('gửi đúng bytes lên Cloudinary', async () => {
      await adapter.put(KEY, PDF, 'application/pdf');
      expect(mock.uploads[0].body.equals(PDF)).toBe(true);
    });

    it('get trả về đúng Buffer đã tải', async () => {
      const out = await adapter.get(KEY);
      expect(out.equals(PDF)).toBe(true);
    });

    it('upload lỗi -> reject, không nuốt lỗi', async () => {
      mock.failUpload(new Error('mạng hỏng'));
      await expect(adapter.put(KEY, PDF, 'application/pdf')).rejects.toThrow('mạng hỏng');
    });

    it('404 -> ném lỗi có nêu key', async () => {
      const missing = new CloudinaryStorageAdapter(mock.client, makeFetch(Buffer.alloc(0), false, 404));
      await expect(missing.get(KEY)).rejects.toThrow(KEY);
    });
  });

  describe('delete', () => {
    it('xoá đúng resource authenticated', async () => {
      await adapter.delete(KEY);
      expect(mock.destroyCalls[0]).toEqual({
        publicId: KEY,
        options: { resource_type: 'raw', type: 'authenticated' },
      });
    });

    it('file không tồn tại -> vẫn coi là xoá xong (idempotent)', async () => {
      mock.setDestroyResult({ result: 'not found' });
      await expect(adapter.delete(KEY)).resolves.toBeUndefined();
    });
  });

  it('khai báo provider để File.provider ghi đúng nơi chứa bytes', () => {
    expect(adapter.provider).toBe('cloudinary');
  });
});
