import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { RawData, WebSocket } from 'ws';
import type { JwtPayload } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { ScratchAccessService } from '../scratch-access.service';
import { COLLAB_MAX_OP_BYTES, CollabRooms, type CollabMember } from './collab-rooms';

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
/** Kiểm lại quyền của mọi kết nối đang trong phòng (tài khoản bị khóa, mất quyền sửa giữa chừng). */
const RECHECK_MS = 60_000;
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

const isSeq = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * Làm chung thời gian thực (ADR 003 D5′; T11.6a spike → T11.6b). WebSocket thuần ở `/api/scratch/ws`.
 *
 * Giao thức (JSON):
 *   → {type:'auth', token}            bắt buộc là message ĐẦU TIÊN, trong 5 s (token KHÔNG nằm trên URL —
 *                                     INVARIANT #5: URL hay bị ghi log)
 *   ← {type:'ready'}
 *   → {type:'join', projectId}        chỉ chủ / đồng tác giả (ScratchAccessService.editable)
 *   ← {type:'joined', seq, needsSync, members, lead}
 *   → {type:'op', op}                 ≤ 64 KB
 *   ← {type:'op', seq, from, op}      cho CẢ phòng, kể cả người gửi
 *   → {type:'resync'}                 client thấy mình lệch
 *   ← {type:'sync-request'}           (gửi cho nguồn) hãy lưu phiên bản rồi báo snapshot
 *   → {type:'snapshot', versionSeq, atSeq}
 *   ← {type:'snapshot', versionSeq, atSeq}   (gửi cho máy đang chờ) nạp phiên bản, áp lại op seq > atSeq
 *   ← {type:'reload-latest'}          không còn máy đúng: nạp lại bản đã lưu mới nhất
 *   ← {type:'presence', members, lead}       lead = máy này là người lưu chính
 * Server không hiểu nội dung op — xem collab-rooms.ts.
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
    setInterval(() => this.heartbeat(), HEARTBEAT_MS).unref();
    setInterval(() => void this.recheck(), RECHECK_MS).unref();
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
    if (!st?.projectId) return;
    this.rooms.leave(st.projectId, client);
    this.runSync(st.projectId);
    this.broadcastPresence(st.projectId);
  }

  /** Đá một người khỏi phòng ngay (bị gỡ khỏi đồng tác giả / tự rời). */
  kick(projectId: string, userId: string): void {
    for (const conn of this.rooms.connsOf(projectId, userId)) conn.close(CLOSE.forbidden, 'removed');
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
      if (client.readyState !== client.OPEN) return undefined; // đóng trong lúc kiểm quyền
      const res = this.rooms.join(projectId, { conn: client, userId: st.userId, name: st.name ?? '' });
      if (!res.ok) return client.close(CLOSE.roomFull, 'room full');
      st.projectId = projectId;
      this.send(client, {
        type: 'joined',
        seq: res.seq,
        needsSync: res.needsSync,
        members: presence(res.members),
        lead: this.rooms.leader(projectId) === client,
      });
      this.runSync(projectId);
      return this.broadcastPresence(projectId, client);
    }

    const projectId = st.projectId;
    if (!projectId) return undefined;

    if (msg.type === 'op' && msg.op !== undefined) {
      const out = this.rooms.sequence(projectId, client, msg.op);
      if (!out) return undefined;
      const frame = JSON.stringify({ type: 'op', ...out.entry });
      for (const peer of out.to) peer.send(frame);
    } else if (msg.type === 'resync') {
      if (this.rooms.requestResync(projectId, client)) {
        this.runSync(projectId);
        this.broadcastPresence(projectId);
      }
    } else if (msg.type === 'snapshot' && isSeq(msg.versionSeq) && isSeq(msg.atSeq)) {
      const to = this.rooms.snapshot(projectId, client, msg.atSeq);
      if (!to) return undefined;
      const frame = JSON.stringify({ type: 'snapshot', versionSeq: msg.versionSeq, atSeq: msg.atSeq });
      for (const peer of to) peer.send(frame);
      this.runSync(projectId);
      this.broadcastPresence(projectId);
    }
    return undefined;
  }

  /** Thực hiện kế hoạch đồng bộ của phòng (nhờ nguồn / bảo mọi người nạp lại). */
  private runSync(projectId: string): void {
    const plan = this.rooms.planSync(projectId);
    if (plan.source) this.send(plan.source, { type: 'sync-request' });
    for (const conn of plan.reloadLatest) this.send(conn, { type: 'reload-latest' });
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

  /** Token chỉ kiểm lúc kết nối — định kỳ kiểm lại tài khoản còn hoạt động và còn quyền sửa dự án. */
  private async recheck(): Promise<void> {
    for (const client of this.sockets) {
      const st = this.state.get(client);
      if (!st?.userId || !st.projectId) continue;
      try {
        const user = await this.prisma.user.findUnique({ where: { id: st.userId }, select: { status: true } });
        if (user?.status !== 'active') throw new Error('inactive');
        await this.access.editable(st.projectId, st.userId);
      } catch {
        client.close(CLOSE.forbidden, 'forbidden');
      }
    }
  }

  /** Danh sách người trong phòng + cờ "người lưu chính" riêng cho từng máy. */
  private broadcastPresence(projectId: string, skip?: WebSocket): void {
    const members = this.rooms.members(projectId);
    const leader = this.rooms.leader(projectId);
    const list = presence(members);
    for (const m of members) {
      if (m.conn !== skip) this.send(m.conn, { type: 'presence', members: list, lead: m.conn === leader });
    }
  }

  private send(client: WebSocket, msg: object): void {
    if (client.readyState === client.OPEN) client.send(JSON.stringify(msg));
  }
}

/** Danh sách người trong phòng — trùng người (2 tab) gộp lại. */
function presence(members: CollabMember<unknown>[]): { userId: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const m of members) seen.set(m.userId, m.name);
  return [...seen].map(([userId, name]) => ({ userId, name }));
}

function rawLength(raw: RawData): number {
  if (Array.isArray(raw)) return raw.reduce((n, b) => n + b.length, 0);
  return raw instanceof ArrayBuffer ? raw.byteLength : raw.length;
}
