import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../../lib/api';

export interface CollabMember {
  userId: string;
  name: string;
}

export type CollabStatus = 'off' | 'connecting' | 'live' | 'closed';

interface Bridge {
  onLocalOp: { current: ((op: unknown) => void) | null };
  collabStart: () => void;
  collabApply: (op: unknown) => void;
}

/**
 * Làm chung thời gian thực — SPIKE T11.6a (ADR 003 D5′). Trang LMS giữ WebSocket `/api/scratch/ws` (trình
 * soạn vẫn không cầm token): op máy này tạo → gửi; op server phát lại (đã xếp thứ tự) → áp vào trình soạn,
 * TRỪ op của chính kết nối này (nhận diện bằng `cid` ngẫu nhiên mỗi kết nối — cùng một người mở 2 tab vẫn
 * đồng bộ được giữa 2 tab). Token gửi trong message đầu, KHÔNG trên URL.
 */
export function useCollab(projectId: string, enabled: boolean, bridge: Bridge) {
  const [status, setStatus] = useState<CollabStatus>('off');
  const [members, setMembers] = useState<CollabMember[]>([]);
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;

  useEffect(() => {
    if (!enabled) return undefined;
    const cid = crypto.randomUUID();
    let n = 0;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/api/scratch/ws`);
    setStatus('connecting');

    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: getAccessToken() }));
    ws.onmessage = (ev: MessageEvent<string>) => {
      const msg = JSON.parse(ev.data) as { type: string; [k: string]: unknown };
      if (msg.type === 'ready') ws.send(JSON.stringify({ type: 'join', projectId }));
      else if (msg.type === 'joined') {
        setStatus('live');
        setMembers(msg.members as CollabMember[]);
        bridgeRef.current.collabStart();
        bridgeRef.current.onLocalOp.current = (op) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'op', op: { ...(op as object), cid, n: ++n } }));
          }
        };
      } else if (msg.type === 'presence') setMembers(msg.members as CollabMember[]);
      else if (msg.type === 'op') {
        const op = msg.op as { cid?: string };
        if (op?.cid !== cid) bridgeRef.current.collabApply(op);
      }
    };
    ws.onclose = (ev) => {
      setStatus('closed');
      setCloseCode(ev.code);
      bridgeRef.current.onLocalOp.current = null;
    };
    return () => {
      bridgeRef.current.onLocalOp.current = null;
      ws.close();
    };
  }, [enabled, projectId]);

  return { status, members, closeCode };
}
