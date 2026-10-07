import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  getLatestProjectJson: vi.fn(),
  getProjectAsset: vi.fn(),
  saveProjectVersion: vi.fn(),
  uploadAsset: vi.fn(),
}));

import * as api from './api';
import { fetchProjectForEditor, pushProject, referencedAssets } from './projectSync';

const A = `${'a'.repeat(32)}.png`; // asset riêng của dự án (có trên server)
const L = `${'b'.repeat(32)}.svg`; // asset thư viện Scratch (server trả 404)
const N = `${'c'.repeat(32)}.wav`; // asset mới vẽ/ghi âm trong phiên này
const projectJson = JSON.stringify({
  targets: [
    { costumes: [{ md5ext: L }], sounds: [] },
    { costumes: [{ md5ext: A }, { md5ext: '../evil.png' }], sounds: [{ md5ext: A }] },
  ],
  meta: {},
});
const buf = (n: number) => new Uint8Array([n]).buffer;

beforeEach(() => vi.clearAllMocks());

describe('referencedAssets', () => {
  it('bỏ trùng và bỏ tên không hợp lệ', () => {
    expect(referencedAssets(projectJson).sort()).toEqual([A, L].sort());
  });
});

describe('fetchProjectForEditor', () => {
  it('chưa lưu lần nào → projectJson null, không tải asset', async () => {
    vi.mocked(api.getLatestProjectJson).mockResolvedValue(null);
    await expect(fetchProjectForEditor('p1')).resolves.toMatchObject({ projectJson: null, assets: [] });
    expect(api.getProjectAsset).not.toHaveBeenCalled();
  });

  it('chỉ đưa asset của server vào trình soạn; asset thư viện (404) để CDN lo nhưng vẫn coi là đã biết', async () => {
    vi.mocked(api.getLatestProjectJson).mockResolvedValue(projectJson);
    vi.mocked(api.getProjectAsset).mockImplementation(async (_id, md5ext) => (md5ext === A ? buf(1) : null));
    const loaded = await fetchProjectForEditor('p1');
    expect(loaded.assets.map((a) => a.md5ext)).toEqual([A]);
    expect([...loaded.known].sort()).toEqual([A, L].sort());
  });
});

describe('pushProject', () => {
  it('chỉ tải asset chưa biết, trước khi lưu phiên bản; lần sau không gửi lại', async () => {
    const order: string[] = [];
    vi.mocked(api.uploadAsset).mockImplementation(async (md5ext) => {
      order.push(`upload ${md5ext}`);
      return { md5ext, sizeBytes: 1, created: true };
    });
    vi.mocked(api.saveProjectVersion).mockImplementation(async () => {
      order.push('save');
      return { id: 'v', seq: 3, sizeBytes: 1, frozen: false, savedById: 'u', createdAt: '' };
    });
    const known = new Set([A, L]);
    const exported = {
      projectJson,
      title: 'T',
      assets: [
        { md5ext: A, data: buf(1) },
        { md5ext: L, data: buf(2) },
        { md5ext: N, data: buf(3) },
      ],
    };
    await expect(pushProject('p1', exported, known)).resolves.toMatchObject({ seq: 3 });
    expect(order).toEqual([`upload ${N}`, 'save']);
    expect(known.has(N)).toBe(true);

    order.length = 0;
    await pushProject('p1', exported, known);
    expect(order).toEqual(['save']);
  });

  it('tải asset lỗi → KHÔNG lưu phiên bản (tránh phiên bản trỏ asset không có)', async () => {
    vi.mocked(api.uploadAsset).mockRejectedValue(new Error('quota'));
    await expect(
      pushProject('p1', { projectJson, title: 'T', assets: [{ md5ext: N, data: buf(3) }] }, new Set()),
    ).rejects.toThrow('quota');
    expect(api.saveProjectVersion).not.toHaveBeenCalled();
  });
});
