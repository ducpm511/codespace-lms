import { useCallback, useEffect, useRef, useState } from 'react';

/** URL trình soạn BlockSpace (apps/studio, phục vụ bởi vite-plugin-static-copy). */
export const BLOCKSPACE_EDITOR_URL = '/studio/editor/index.html';

type EditorMessage =
  | { type: 'blockspace:ready' }
  | { type: 'blockspace:loaded' }
  | { type: 'blockspace:changed' }
  | { type: 'blockspace:saved'; requestId: string; sb3: ArrayBuffer; title: string }
  | { type: 'blockspace:exported'; requestId: string; projectJson: string; assets: EditorAsset[]; title: string }
  | { type: 'blockspace:error'; requestId?: string; message: string };

/** Asset (ảnh/âm thanh) theo tên Scratch: "<md5>.<đuôi>". */
export interface EditorAsset {
  md5ext: string;
  data: ArrayBuffer;
}

export interface EditorExport {
  projectJson: string;
  assets: EditorAsset[];
  title: string;
}

export interface BlockSpaceState {
  ready: boolean;
  /** Có thay đổi chưa lưu kể từ lần nạp/lưu gần nhất. */
  dirty: boolean;
  error: string | null;
  /** ms từ lúc gắn iframe tới khi trình soạn báo sẵn sàng — số đo của spike T11.1. */
  readyMs: number | null;
  /** Tăng mỗi lần trình soạn nạp xong một dự án (open / load / new). */
  loadCount: number;
}

/**
 * Cầu nối trang LMS ↔ iframe BlockSpace qua postMessage (giao thức: apps/studio/README.md).
 * Chỉ nhận message cùng origin VÀ từ đúng iframe này.
 */
export function useBlockSpace() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mountedAt = useRef(performance.now());
  const pendingSaves = useRef(new Map<string, (r: { sb3: ArrayBuffer; title: string }) => void>());
  // Đếm số lần trình soạn báo "đã đổi" (ref: sự kiện dày khi kéo khối, không cần render lại).
  const changeSeq = useRef(0);
  const pendingExports = useRef(new Map<string, { resolve: (r: EditorExport) => void; reject: (e: Error) => void }>());
  const [state, setState] = useState<BlockSpaceState>({
    ready: false,
    dirty: false,
    error: null,
    readyMs: null,
    loadCount: 0,
  });

  const send = useCallback((msg: object, transfer: Transferable[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(msg, window.location.origin, transfer);
  }, []);

  const load = useCallback(
    (sb3: ArrayBuffer, title?: string) => {
      setState((s) => ({ ...s, error: null }));
      send({ type: 'blockspace:load', sb3, title }, [sb3]);
    },
    [send],
  );

  /** Dự án mới = dự án mặc định (nhân vật Rex) dựng sẵn trong trình soạn. */
  const loadDefault = useCallback(
    (title?: string) => {
      setState((s) => ({ ...s, error: null }));
      send({ type: 'blockspace:new', title });
    },
    [send],
  );

  /** Mở dự án từ server: project.json + asset đã tải (trình soạn không gọi API). */
  const open = useCallback(
    (projectJson: string, assets: EditorAsset[], title?: string) => {
      setState((s) => ({ ...s, error: null }));
      send(
        { type: 'blockspace:open', projectJson, assets, title },
        assets.map((a) => a.data),
      );
    },
    [send],
  );

  /** Lấy project.json + mọi asset đang dùng để lưu lên server. */
  const exportProject = useCallback(
    () =>
      new Promise<EditorExport>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        pendingExports.current.set(requestId, { resolve, reject });
        send({ type: 'blockspace:export', requestId });
      }),
    [send],
  );

  /**
   * Lưu lên server xong: hạ cờ "chưa lưu" CHỈ khi không có thay đổi nào sau lúc xuất (`seqAtExport` =
   * `changeSeq.current` đọc ngay trước exportProject) — sửa tiếp trong lúc đang lưu vẫn còn "chưa lưu".
   */
  const markSaved = useCallback((seqAtExport: number) => {
    if (changeSeq.current === seqAtExport) setState((s) => ({ ...s, dirty: false }));
  }, []);

  const save = useCallback(
    () =>
      new Promise<{ sb3: ArrayBuffer; title: string }>((resolve) => {
        const requestId = crypto.randomUUID();
        pendingSaves.current.set(requestId, resolve);
        send({ type: 'blockspace:save', requestId });
      }),
    [send],
  );

  useEffect(() => {
    const onMessage = (ev: MessageEvent<EditorMessage>) => {
      if (ev.origin !== window.location.origin || ev.source !== iframeRef.current?.contentWindow) return;
      const msg = ev.data;
      switch (msg?.type) {
        case 'blockspace:ready':
          setState((s) => ({ ...s, ready: true, readyMs: Math.round(performance.now() - mountedAt.current) }));
          break;
        case 'blockspace:loaded':
          setState((s) => ({ ...s, dirty: false, loadCount: s.loadCount + 1 }));
          break;
        case 'blockspace:changed':
          changeSeq.current += 1;
          setState((s) => (s.dirty ? s : { ...s, dirty: true }));
          break;
        case 'blockspace:saved': {
          const resolve = pendingSaves.current.get(msg.requestId);
          pendingSaves.current.delete(msg.requestId);
          setState((s) => ({ ...s, dirty: false }));
          resolve?.({ sb3: msg.sb3, title: msg.title });
          break;
        }
        case 'blockspace:exported': {
          const pending = pendingExports.current.get(msg.requestId);
          pendingExports.current.delete(msg.requestId);
          pending?.resolve({ projectJson: msg.projectJson, assets: msg.assets, title: msg.title });
          break;
        }
        case 'blockspace:error': {
          const pending = msg.requestId ? pendingExports.current.get(msg.requestId) : undefined;
          if (pending) {
            pendingExports.current.delete(msg.requestId!);
            pending.reject(new Error(msg.message));
          } else {
            setState((s) => ({ ...s, error: msg.message }));
          }
          break;
        }
        default:
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return { iframeRef, state, load, loadDefault, save, open, exportProject, markSaved, changeSeq };
}
