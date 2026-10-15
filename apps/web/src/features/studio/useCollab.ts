import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { getAccessToken } from '../../lib/api';
import { getProject } from './api';
import { CollabClient, type CollabEditor, type CollabOp, type CollabView } from './collabClient';

export type { CollabView } from './collabClient';

interface Bridge {
  onLocalOp: MutableRefObject<((op: unknown) => void) | null>;
  onStructure: MutableRefObject<((renames: Record<string, string>) => void) | null>;
  onCollabError: MutableRefObject<((message: string) => void) | null>;
  collabStart: () => void;
  collabApply: (op: unknown) => void;
}

/** Mã đóng không nối lại: 4003 bị gỡ / mất quyền, 4009 phòng đầy, 4008 gói hỏng. */
const FINAL_CODES = new Set([4003, 4008, 4009]);
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 10_000];

/**
 * Làm chung thời gian thực (ADR 003 D5′, T11.6b). Trang LMS giữ WebSocket `/api/scratch/ws` (trình soạn vẫn
 * không cầm token; token gửi trong message đầu, KHÔNG trên URL). Logic đồng bộ ở `CollabClient`; hook này lo
 * kết nối + tự nối lại. Rớt mạng ⇒ `offline` (trang che trình soạn — không sửa offline rồi gộp).
 */
export function useCollab(
  projectId: string,
  enabled: boolean,
  bridge: Bridge,
  editor: Omit<CollabEditor, 'apply'>,
  knownVersionSeq: number | null,
): { view: CollabView | null; client: MutableRefObject<CollabClient | null> } {
  const [view, setView] = useState<CollabView | null>(null);
  const client = useRef<CollabClient | null>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const knownRef = useRef(knownVersionSeq);
  knownRef.current = knownVersionSeq;

  useEffect(() => {
    if (!enabled) return undefined;
    const c = new CollabClient(
      {
        apply: (op: CollabOp) => bridgeRef.current.collabApply(op),
        reload: (v) => editorRef.current.reload(v),
        snapshot: (onExport) => editorRef.current.snapshot(onExport),
        latestVersionSeq: () => editorRef.current.latestVersionSeq(),
        remoteSaved: () => editorRef.current.remoteSaved(),
      },
      setView,
      knownRef.current,
    );
    client.current = c;
    const b = bridgeRef.current;
    b.onLocalOp.current = (op) => c.localOp(op as CollabOp);
    b.onStructure.current = (renames) => c.structureChanged(renames);
    b.onCollabError.current = () => c.applyFailed();

    let ws: WebSocket | null = null;
    let disposed = false;
    let attempt = 0;
    let authRetried = false;
    let timer: number | undefined;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const sock = new WebSocket(`${proto}://${window.location.host}/api/scratch/ws`);
      ws = sock;
      c.connected((msg) => {
        if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
      });
      sock.onopen = () => sock.send(JSON.stringify({ type: 'auth', token: getAccessToken() }));
      sock.onmessage = (ev: MessageEvent<string>) => {
        const msg = JSON.parse(ev.data) as { type: string; [k: string]: unknown };
        if (msg.type === 'ready') sock.send(JSON.stringify({ type: 'join', projectId }));
        else {
          if (msg.type === 'joined') {
            attempt = 0;
            authRetried = false;
            bridgeRef.current.collabStart();
          }
          c.handle(msg);
        }
      };
      sock.onclose = (ev) => {
        if (disposed) return;
        // Token hết hạn: gọi một API có token để lib/api tự làm mới, rồi thử lại MỘT lần.
        const retryAuth = ev.code === 4001 && !authRetried;
        const final = FINAL_CODES.has(ev.code) || (ev.code === 4001 && authRetried);
        c.disconnected(ev.code, final);
        if (final) return;
        if (retryAuth) authRetried = true;
        const delay = BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)];
        timer = window.setTimeout(() => {
          if (retryAuth)
            void getProject(projectId)
              .catch(() => undefined)
              .finally(connect);
          else connect();
        }, delay);
      };
    };
    connect();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      c.dispose();
      ws?.close();
      client.current = null;
      b.onLocalOp.current = null;
      b.onStructure.current = null;
      b.onCollabError.current = null;
      setView(null);
    };
  }, [enabled, projectId]);

  return { view, client };
}
