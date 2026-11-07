import { SCRATCH_BACKPACK_ITEM_TYPES, SCRATCH_BACKPACK_PAGE_MAX } from '@lms/contracts';
import type { ScratchBackpackItemDto, ScratchBackpackItemTypeValue } from '@lms/contracts';
import { addBackpackItem, deleteBackpackItem, getBackpackBody, listBackpack } from './api';

/**
 * Ba lô của trình soạn: bridge (iframe, không có token) gửi lệnh, trang LMS gọi API `/scratch/backpack` của
 * CHÍNH người đăng nhập rồi trả kết quả. Giao thức: apps/studio/README.md.
 */
export type BackpackRequest =
  | { type: 'blockspace:backpack-list'; requestId: string; offset: number; limit: number }
  | {
      type: 'blockspace:backpack-save';
      requestId: string;
      item: { type: ScratchBackpackItemTypeValue; name: string };
      body: ArrayBuffer;
      thumbnail: ArrayBuffer;
    }
  | { type: 'blockspace:backpack-delete'; requestId: string; id: string };

export interface BackpackReply {
  message: {
    type: 'blockspace:backpack-result';
    requestId: string;
    ok: boolean;
    message?: string;
    item?: ScratchBackpackItemDto;
    items?: { item: ScratchBackpackItemDto; data: ArrayBuffer }[];
  };
  transfer: Transferable[];
}

export const isBackpackRequest = (msg: { type?: unknown } | null | undefined): msg is BackpackRequest =>
  typeof msg?.type === 'string' && msg.type.startsWith('blockspace:backpack-') && msg.type !== 'blockspace:backpack-result';

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(Math.max(v, min), max) : fallback;

/** Thực hiện một lệnh ba lô; không bao giờ ném — lỗi trả về `ok: false` để trình soạn hiện trạng thái lỗi. */
export async function handleBackpackRequest(msg: BackpackRequest): Promise<BackpackReply> {
  const requestId = String(msg.requestId);
  try {
    switch (msg.type) {
      case 'blockspace:backpack-list': {
        const offset = clampInt(msg.offset, 0, 1_000_000, 0);
        const limit = clampInt(msg.limit, 1, SCRATCH_BACKPACK_PAGE_MAX, 20);
        const items = await listBackpack(offset, limit);
        // Trình soạn cần nội dung ngay lúc kéo ra (nó không gọi API được) → tải kèm. Mục vừa bị xóa ở tab
        // khác (404) thì bỏ qua.
        const bodies = await Promise.all(items.map((i) => getBackpackBody(i.id)));
        const withData = items
          .map((item, i) => ({ item, data: bodies[i] }))
          .filter((e): e is { item: ScratchBackpackItemDto; data: ArrayBuffer } => e.data !== null);
        return {
          message: { type: 'blockspace:backpack-result', requestId, ok: true, items: withData },
          transfer: withData.map((e) => e.data),
        };
      }
      case 'blockspace:backpack-save': {
        const { item, body, thumbnail } = msg;
        if (
          !item ||
          !SCRATCH_BACKPACK_ITEM_TYPES.includes(item.type) ||
          !(body instanceof ArrayBuffer) ||
          !(thumbnail instanceof ArrayBuffer)
        ) {
          throw new Error('invalid backpack item');
        }
        const saved = await addBackpackItem(item.type, String(item.name ?? ''), body, thumbnail);
        return { message: { type: 'blockspace:backpack-result', requestId, ok: true, item: saved }, transfer: [] };
      }
      case 'blockspace:backpack-delete':
        await deleteBackpackItem(String(msg.id));
        return { message: { type: 'blockspace:backpack-result', requestId, ok: true }, transfer: [] };
      default:
        throw new Error('unknown backpack request');
    }
  } catch (e) {
    return {
      message: { type: 'blockspace:backpack-result', requestId, ok: false, message: (e as Error).message },
      transfer: [],
    };
  }
}
