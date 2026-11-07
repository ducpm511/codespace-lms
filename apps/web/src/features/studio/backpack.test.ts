import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  listBackpack: vi.fn(),
  getBackpackBody: vi.fn(),
  addBackpackItem: vi.fn(),
  deleteBackpackItem: vi.fn(),
}));

import * as api from './api';
import { handleBackpackRequest, isBackpackRequest } from './backpack';

const item = (id: string) => ({
  id,
  type: 'sprite' as const,
  name: 'Rex',
  mime: 'application/zip',
  md5ext: null,
  sizeBytes: 1,
  thumbnail: '',
  createdAt: '',
});
const buf = () => new Uint8Array([1]).buffer;

beforeEach(() => vi.clearAllMocks());

describe('isBackpackRequest', () => {
  it('nhận lệnh từ trình soạn, không nhận kết quả do chính trang gửi', () => {
    expect(isBackpackRequest({ type: 'blockspace:backpack-list' })).toBe(true);
    expect(isBackpackRequest({ type: 'blockspace:backpack-result' })).toBe(false);
    expect(isBackpackRequest({ type: 'blockspace:export' })).toBe(false);
    expect(isBackpackRequest(null)).toBe(false);
  });
});

describe('handleBackpackRequest', () => {
  it('list: kẹp limit, tải kèm nội dung, bỏ mục đã bị xóa (404)', async () => {
    vi.mocked(api.listBackpack).mockResolvedValue([item('a'), item('b')]);
    vi.mocked(api.getBackpackBody).mockImplementation((id) => Promise.resolve(id === 'a' ? buf() : null));
    const { message, transfer } = await handleBackpackRequest({
      type: 'blockspace:backpack-list',
      requestId: 'r1',
      offset: 0,
      limit: 500,
    });
    expect(api.listBackpack).toHaveBeenCalledWith(0, 40);
    expect(message).toMatchObject({ type: 'blockspace:backpack-result', requestId: 'r1', ok: true });
    expect(message.items?.map((e) => e.item.id)).toEqual(['a']);
    expect(transfer).toHaveLength(1);
  });

  it('save: chặn loại lạ trước khi gọi API', async () => {
    const { message } = await handleBackpackRequest({
      type: 'blockspace:backpack-save',
      requestId: 'r2',
      item: { type: 'project' as never, name: 'x' },
      body: buf(),
      thumbnail: buf(),
    });
    expect(message.ok).toBe(false);
    expect(api.addBackpackItem).not.toHaveBeenCalled();
  });

  it('lỗi API (vd ba lô đầy) trả ok:false kèm lý do, không ném', async () => {
    vi.mocked(api.addBackpackItem).mockRejectedValue(new Error('Ba lô đã đầy'));
    const { message } = await handleBackpackRequest({
      type: 'blockspace:backpack-save',
      requestId: 'r3',
      item: { type: 'sprite', name: 'Rex' },
      body: buf(),
      thumbnail: buf(),
    });
    expect(message).toMatchObject({ ok: false, message: 'Ba lô đã đầy', requestId: 'r3' });
  });

  it('delete', async () => {
    vi.mocked(api.deleteBackpackItem).mockResolvedValue();
    const { message } = await handleBackpackRequest({ type: 'blockspace:backpack-delete', requestId: 'r4', id: 'a' });
    expect(api.deleteBackpackItem).toHaveBeenCalledWith('a');
    expect(message.ok).toBe(true);
  });
});
