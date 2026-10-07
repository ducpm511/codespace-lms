import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { RawData, WebSocket } from 'ws';
import type { JwtPayload } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { ScratchAccessService } from '../scratch-access.service';
import { COLLAB_MAX_OP_BYTES, CollabRooms } from './collab-rooms';

/** Đóng kết nối với mã riêng (4xxx) để client biết lý do, không phải đoán. */
export const CLOSE = {
  authTimeout: 4000,
  unauthorized: 4001,
  forbidden: 4003,
  tooLarge: 4008,
  roomFull: 4009,
  rateLimited: 4029,
} as const;

const AUTH_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 30_000;
/** Tối đa ngần này message mỗi cửa sổ — thao tác tay thật hiếm khi quá vài sự kiện/giây. */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 100;

interface ConnState {
  userId?: string;
  name?: string;
  projectId?: string;
  alive: boolean;
  window: number;
  count: number;
}

/**
 * Làm chung thời gian thực (T11.6a — SPIKE, ADR 003 D5′). WebSocket thuần ở `/api/scratch/ws`.
 *
 * Giao thức (JSON):
 *   → {type:'auth', token}                  bắt buộc là message ĐẦU TIÊN, trong 5 s (token KHÔNG nằm trên URL —
 *                                           INVARIANT #5: URL hay bị ghi log)
 *   ← {type:'ready'}
 *   → {type:'join', projectId, sinceSeq?}   chỉ chủ / đồng tác giả (ScratchAccessService.editable)
 *   ← {type:'joined', seq, catchUp|null, members}   catchUp null = nạp lại dự án
 *   → {type:'op', op}                       ≤ 64 KB
 *   ← {type:'op', seq, from, op}            cho CẢ phòng, kể cả người gửi
 *   ← {type:'presence', members}
 * Server KHÔNG hiểu nội dung op (chỉ xếp thứ tự + phát) — lưu snapshot là việc của T11.6b.
 */
@WebSocketGateway({ path: '/api/scratch/ws' })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CollabGateway.name);
  readonly rooms = new CollabRooms<WebSocket>();
  private readonly state = new WeakMap<WebSocket, ConnState>();
  private readonly sockets = new Set<WebSocket>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: ScratchAccessService,
    private readonly prisma: PrismaService,
  ) {
    const heartbeat = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    heartbeat.unref();
  }

  handleConnection(client: WebSocket): void {
    const st: ConnState = { alive: true, window: Date.now(), count: 0 };
    this.state.set(client, st);
    this.sockets.add(client);
    const authTimer = setTimeout(() => {
      if (!st.userId) client.close(CLOSE.authTimeout, 'auth timeout');
    }, AUTH_TIMEOUT_MS);
    client.on('pong', () => (st.alive = true));
    client.on('close', () => clearTimeout(authTimer));
    client.on('message', (raw: RawData, isBinary: boolean) => {
      void this.onMessage(client, st, raw, isBinary).catch((e: unknown) => {
        this.logger.warn(`collab message failed: ${e instanceof Error ? e.message : String(e)}`);
        this.send(client, { type: 'error', message: 'Lỗi xử lý' });
      });
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.sockets.delete(client);
    const st = this.state.get(client);
    if (st?.projectId) this.broadcastPresence(this.rooms.leave(st.projectId, client));
  }

  private async onMessage(client: WebSocket, st: ConnState, raw: RawData, isBinary: boolean): Promise<void> {
    const bytes = rawLength(raw);
    if (isBinary || bytes > COLLAB_MAX_OP_BYTES) return client.close(CLOSE.tooLarge, 'message too large');
    if (!this.allow(st)) return client.close(CLOSE.rateLimited, 'rate limited');
    let msg: { type?: unknown; [k: string]: unknown };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return client.close(CLOSE.tooLarge, 'invalid json');
    }

    if (!st.userId) {
      if (msg.type !== 'auth' || typeof msg.token !== 'string') return client.close(CLOSE.unauthorized, 'auth first');
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(msg.token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { fullName: true, status: true },
        });
        if (!user || user.status !== 'active') return client.close(CLOSE.unauthorized, 'unauthorized');
        st.userId = payload.sub;
        st.name = user.fullName;
      } catch {
        return client.close(CLOSE.unauthorized, 'unauthorized');
      }
      return this.send(client, { type: 'ready' });
    }

    if (msg.type === 'join') {
      if (st.projectId || typeof msg.projectId !== 'string') return client.close(CLOSE.forbidden, 'bad join');
      const projectId = msg.projectId;
      try {
        await this.access.editable(projectId, st.userId);
      } catch {
        return client.close(CLOSE.forbidden, 'forbidden');
      }
      const sinceSeq = typeof msg.sinceSeq === 'number' && msg.sinceSeq >= 0 ? msg.sinceSeq : undefined;
      const res = this.rooms.join(projectId, { conn: client, userId: st.userId, name: st.name ?? '' }, sinceSeq);
      if (!res.ok) return client.close(CLOSE.roomFull, 'room full');
      st.projectId = projectId;
      this.send(client, { type: 'joined', seq: res.seq, catchUp: res.catchUp, members: presence(res.members) });
      return this.broadcastPresence(this.rooms.members(projectId));
    }

    if (msg.type === 'op' && st.projectId && msg.op !== undefined) {
      const out = this.rooms.sequence(st.projectId, client, msg.op, bytes);
      if (!out) return;
      const frame = JSON.stringify({ type: 'op', ...out.entry });
      for (const peer of out.to) peer.send(frame);
    }
  }

  private allow(st: ConnState): boolean {
    const now = Date.now();
    if (now - st.window > RATE_WINDOW_MS) {
      st.window = now;
      st.count = 0;
    }
    st.count += 1;
    return st.count <= RATE_MAX;
  }

  private heartbeat(): void {
    for (const client of this.sockets) {
      const st = this.state.get(client);
      if (!st) continue;
      if (!st.alive) {
        client.terminate();
        continue;
      }
      st.alive = false;
      client.ping();
    }
  }

  private broadcastPresence(members: { conn: WebSocket; userId: string; name: string }[]): void {
    const frame = JSON.stringify({ type: 'presence', members: presence(members) });
    for (const m of members) m.conn.send(frame);
  }

  private send(client: WebSocket, msg: object): void {
    client.send(JSON.stringify(msg));
  }
}

/** Danh sách người trong phòng — trùng người (2 tab) gộp lại. */
function presence(members: { userId: string; name: string }[]): { userId: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const m of members) seen.set(m.userId, m.name);
  return [...seen].map(([userId, name]) => ({ userId, name }));
}

function rawLength(raw: RawData): number {
  if (Array.isArray(raw)) return raw.reduce((n, b) => n + b.length, 0);
  return raw instanceof ArrayBuffer ? raw.byteLength : raw.length;
}
