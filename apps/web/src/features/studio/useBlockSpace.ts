import { useCallback, useEffect, useRef, useState } from 'react';

/** URL trình soạn BlockSpace (apps/studio, phục vụ bởi vite-plugin-static-copy). */
export const BLOCKSPACE_EDITOR_URL = '/studio/editor/index.html';
const DEFAULT_PROJECT_URL = '/studio/editor/default-project.sb3';

type EditorMessage =
  | { type: 'blockspace:ready' }
  | { type: 'blockspace:loaded' }
  | { type: 'blockspace:changed' }
  | { type: 'blockspace:saved'; requestId: string; sb3: ArrayBuffer; title: string }
  | { type: 'blockspace:error'; requestId?: string; message: string };

export interface BlockSpaceState {
  ready: boolean;
  /** Có thay đổi chưa lưu kể từ lần nạp/lưu gần nhất. */
  dirty: boolean;
  error: string | null;
  /** ms từ lúc gắn iframe tới khi trình soạn báo sẵn sàng — số đo của spike T11.1. */
  readyMs: number | null;
}

/**
 * Cầu nối trang LMS ↔ iframe BlockSpace qua postMessage (giao thức: apps/studio/README.md).
 * Chỉ nhận message cùng origin VÀ từ đúng iframe này.
 */
export function useBlockSpace() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mountedAt = useRef(performance.now());
  const pendingSaves = useRef(new Map<string, (r: { sb3: ArrayBuffer; title: string }) => void>());
  const [state, setState] = useState<BlockSpaceState>({ ready: false, dirty: false, error: null, readyMs: null });

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

  const loadDefault = useCallback(
    async (title?: string) => {
      const res = await fetch(DEFAULT_PROJECT_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      load(await res.arrayBuffer(), title);
    },
    [load],
  );

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
          setState((s) => ({ ...s, dirty: false }));
          break;
        case 'blockspace:changed':
          setState((s) => (s.dirty ? s : { ...s, dirty: true }));
          break;
        case 'blockspace:saved': {
          const resolve = pendingSaves.current.get(msg.requestId);
          pendingSaves.current.delete(msg.requestId);
          setState((s) => ({ ...s, dirty: false }));
          resolve?.({ sb3: msg.sb3, title: msg.title });
          break;
        }
        case 'blockspace:error':
          setState((s) => ({ ...s, error: msg.message }));
          break;
        default:
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return { iframeRef, state, load, loadDefault, save };
}
