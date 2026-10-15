/**
 * Phía client của làm chung BlockSpace (ADR 003 D5′, T11.6b) — KHÔNG phụ thuộc React / WebSocket để test được.
 * Giao thức server: apps/api/src/scratch/collab/collab.gateway.ts.
 *
 * Mô hình: server xếp thứ tự mọi op. Máy này áp op của MÌNH ngay (Blockly đã vẽ xong trước khi ta biết) rồi
 * mới nhận lại thứ tự, nên chỉ lệch khi op của mình và op người khác ĐỤNG CÙNG khối / biến mà op người khác
 * được xếp trước. Máy phát hiện được điều đó chính là máy sai (máy kia đã áp đúng thứ tự server) ⇒ nó xin
 * đồng bộ lại (`resync`) thay vì cố gộp.
 *
 * Đồng bộ = nạp một phiên bản ĐÃ LƯU (máy đúng vừa lưu ở `atSeq`) rồi áp lại theo thứ tự mọi op seq > atSeq
 * mà máy này đã nhận — kể cả op của chính mình. Cùng cơ chế dùng cho:
 * - vào phòng đang có người / nối lại;
 * - thay đổi "cấu trúc" (thêm/xóa/đổi tên nhân vật, costume, âm thanh, ghi chú): không gửi từng sự kiện mà
 *   máy tạo ra lưu phiên bản rồi phát op `reload` — các máy khác nạp phiên bản đó.
 */

/** Op khối (sự kiện Blockly đã tuần tự hóa) hoặc op điều khiển (`kind`). */
export interface CollabOp {
  target?: string;
  e?: {
    type?: string;
    blockId?: string;
    ids?: string[];
    newParentId?: string;
    oldParentId?: string;
    varId?: string;
    [k: string]: unknown;
  };
  /** reload: nạp phiên bản `versionSeq` (lưu ở atSeq); saved: người lưu chính vừa lưu `versionSeq`. */
  kind?: 'reload' | 'saved';
  versionSeq?: number;
  atSeq?: number;
  /** Đổi tên nhân vật trong lần reload này (tên cũ → tên mới) — op cũ nhắm tên cũ vẫn áp đúng. */
  renames?: Record<string, string>;
  cid?: string;
  n?: number;
}

export interface CollabEditor {
  apply(op: CollabOp): void;
  /** Nạp phiên bản `versionSeq` (null = mới nhất), giữ nhân vật đang sửa; xong mới resolve. */
  reload(versionSeq: number | null): Promise<void>;
  /** Lưu trạng thái hiện tại thành phiên bản mới; gọi `onExport` NGAY trước khi xuất. Trả seq phiên bản. */
  snapshot(onExport: () => void): Promise<number>;
  latestVersionSeq(): Promise<number | null>;
  /** Người lưu chính vừa lưu bản chứa mọi thay đổi máy này đã thấy. */
  remoteSaved(): void;
}

export interface CollabMember {
  userId: string;
  name: string;
}

/**
 * connecting: đang nối. syncing: đang nạp trạng thái phòng (che trình soạn). live: làm chung bình thường.
 * offline: rớt mạng, đang nối lại (che — không cho sửa offline rồi gộp, ADR D5′). ended: không nối lại nữa.
 */
export type CollabPhase = 'connecting' | 'syncing' | 'live' | 'offline' | 'ended';

export interface CollabView {
  phase: CollabPhase;
  members: CollabMember[];
  /** Máy này là người lưu chính (chỉ máy này tự lưu). */
  lead: boolean;
  /** Mã đóng khi `ended` (4003 = bị gỡ / mất quyền, 4009 = phòng đầy…). */
  endCode: number | null;
}

/** Giữ ngần này op gần nhất để áp lại sau khi nạp phiên bản. */
const LOG_MAX = 2000;
/** Đợi op của mình được xếp thứ tự hết trước khi lưu snapshot — quá lâu thì lưu luôn. */
const PENDING_WAIT_MS = 5_000;
/** Chờ snapshot quá lâu (máy nguồn lưu hỏng…) ⇒ nạp bản đã lưu mới nhất cho khỏi treo. */
export const SYNC_TIMEOUT_MS = 15_000;
/** Thay đổi cấu trúc dồn dập (vẽ trong trình vẽ) — chỉ lưu + phát sau khi yên ngần này. */
export const STRUCTURE_QUIET_MS = 1_500;

/** Khối / biến một op đụng tới — để phát hiện hai người sửa cùng chỗ. */
export function touchedIds(op: CollabOp): string[] {
  const e = op.e;
  if (!e) return [];
  const out: string[] = [];
  for (const k of ['blockId', 'newParentId', 'oldParentId', 'varId'] as const) {
    if (typeof e[k] === 'string') out.push(e[k] as string);
  }
  if (Array.isArray(e.ids)) for (const id of e.ids) if (typeof id === 'string') out.push(id);
  return out;
}

type ServerMsg = { type: string; [k: string]: unknown };

export class CollabClient {
  readonly cid = crypto.randomUUID();
  private n = 0;
  private lastSeq = 0;
  private log: { seq: number; op: CollabOp }[] = [];
  /** Log có đủ mọi op seq > logFrom. */
  private logFrom = 0;
  /** Op của mình đã gửi, chưa nhận lại thứ tự: n → khối đụng tới. */
  private pending = new Map<number, string[]>();
  /** Op của mình gửi TRƯỚC một lần nạp lại: phiên bản vừa nạp không có chúng ⇒ nhận lại thì phải áp. */
  private reapply = new Set<number>();
  private renames: Record<string, string> = {};
  private view: CollabView = { phase: 'connecting', members: [], lead: false, endCode: null };
  private loading: Promise<void> = Promise.resolve();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private structureTimer: ReturnType<typeof setTimeout> | null = null;
  private structureRenames: Record<string, string> = {};
  private send: ((msg: object) => void) | null = null;
  /** Phiên bản đã lưu mà trạng thái máy này dựa trên / đã biết — nối lại một mình thì so với bản mới nhất. */
  knownVersionSeq: number | null;

  constructor(
    private readonly editor: CollabEditor,
    private readonly onView: (v: CollabView) => void,
    knownVersionSeq: number | null,
  ) {
    this.knownVersionSeq = knownVersionSeq;
  }

  get hasPending(): boolean {
    return this.pending.size > 0;
  }

  // --- Kết nối ---

  connected(send: (msg: object) => void): void {
    this.send = send;
    this.setView({ phase: 'connecting' });
  }

  disconnected(code: number, final: boolean): void {
    this.send = null;
    // Op chưa xác nhận của kết nối cũ không bao giờ được xác nhận nữa.
    this.pending.clear();
    this.reapply.clear();
    this.clearTimers();
    this.setView(final ? { phase: 'ended', endCode: code, lead: false } : { phase: 'offline', lead: false });
  }

  handle(msg: ServerMsg): void {
    switch (msg.type) {
      case 'joined':
        this.lastSeq = msg.seq as number;
        this.logFrom = this.lastSeq;
        this.log = [];
        this.setView({ members: msg.members as CollabMember[], lead: msg.lead === true });
        if (msg.needsSync) this.startSyncWait();
        else void this.joinedAlone();
        break;
      case 'presence':
        this.setView({ members: msg.members as CollabMember[], lead: msg.lead === true });
        break;
      case 'op':
        this.onOp(msg.seq as number, msg.op as CollabOp);
        break;
      case 'sync-request':
        void this.serveSnapshot();
        break;
      case 'snapshot':
        this.loadAndReplay(msg.versionSeq as number, msg.atSeq as number);
        break;
      case 'reload-latest':
        this.loadAndReplay(null, this.lastSeq);
        break;
      default:
    }
  }

  // --- Từ trình soạn ---

  /** Sự kiện khối do người dùng máy này tạo. */
  localOp(op: CollabOp): void {
    if (!this.send || this.view.phase !== 'live') return; // đang che trình soạn — thay đổi sẽ bị nạp đè
    const n = ++this.n;
    this.pending.set(n, touchedIds(op));
    this.send({ type: 'op', op: { ...op, cid: this.cid, n } });
  }

  /** Trình soạn báo thay đổi cấu trúc (có thể kèm đổi tên nhân vật) — gộp rồi lưu + phát `reload`. */
  structureChanged(renames: Record<string, string>): void {
    if (this.view.phase !== 'live') return;
    Object.assign(this.structureRenames, renames);
    if (this.structureTimer) clearTimeout(this.structureTimer);
    this.structureTimer = setTimeout(() => void this.publishStructure(), STRUCTURE_QUIET_MS);
  }

  /** Trình soạn không áp được op (khối đã mất…) ⇒ trạng thái lệch. */
  applyFailed(): void {
    this.requestResync();
  }

  /** Trang vừa tự lưu phiên bản `versionSeq` (autosave của người lưu chính / bấm Lưu). */
  saved(versionSeq: number): void {
    this.knownVersionSeq = versionSeq;
    if (this.send && this.view.phase === 'live' && this.view.lead) {
      this.send({ type: 'op', op: { kind: 'saved', versionSeq, cid: this.cid, n: ++this.n } });
    }
  }

  dispose(): void {
    this.clearTimers();
    this.send = null;
  }

  // --- Bên trong ---

  private onOp(seq: number, op: CollabOp): void {
    this.lastSeq = seq;
    this.log.push({ seq, op });
    if (this.log.length > LOG_MAX) this.logFrom = this.log.splice(0, this.log.length - LOG_MAX).pop()!.seq;

    const mine = op.cid === this.cid;
    if (mine && op.n !== undefined) {
      this.pending.delete(op.n);
      if (!this.reapply.delete(op.n)) return; // đã có trong trạng thái máy này
    }
    if (this.view.phase !== 'live') return; // đang nạp: op nằm trong log, áp lại sau

    if (op.kind === 'saved') {
      if (!mine) this.knownVersionSeq = op.versionSeq ?? this.knownVersionSeq;
      if (!this.hasPending) this.editor.remoteSaved();
      return;
    }
    if (op.kind === 'reload') {
      if (!mine) this.loadAndReplay(op.versionSeq ?? null, op.atSeq ?? seq, op.renames);
      return;
    }
    if (!mine && this.conflicts(op)) return this.requestResync();
    this.apply(op);
  }

  private conflicts(op: CollabOp): boolean {
    if (this.pending.size === 0) return false;
    const mineTouched = new Set<string>();
    for (const ids of this.pending.values()) for (const id of ids) mineTouched.add(id);
    return touchedIds(op).some((id) => mineTouched.has(id));
  }

  private apply(op: CollabOp): void {
    const target = op.target !== undefined ? (this.renames[op.target] ?? op.target) : undefined;
    this.editor.apply(target === op.target ? op : { ...op, target });
  }

  private requestResync(): void {
    if (!this.send || this.view.phase !== 'live') return;
    this.send({ type: 'resync' });
    this.startSyncWait();
  }

  /** Chờ server gửi snapshot (hoặc reload-latest); quá lâu ⇒ tự nạp bản đã lưu mới nhất. */
  private startSyncWait(): void {
    this.setView({ phase: 'syncing' });
    for (const n of this.pending.keys()) this.reapply.add(n);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.loadAndReplay(null, this.lastSeq), SYNC_TIMEOUT_MS);
  }

  /** Vào phòng trống. Nối lại mà trong lúc rớt mạng đã có người khác lưu ⇒ bản trên server mới hơn máy này. */
  private async joinedAlone(): Promise<void> {
    const latest = await this.editor.latestVersionSeq().catch(() => this.knownVersionSeq);
    if (latest !== this.knownVersionSeq) this.loadAndReplay(null, this.lastSeq);
    else this.setView({ phase: 'live' });
  }

  /**
   * Nạp phiên bản rồi áp lại theo thứ tự mọi op seq > atSeq đã nhận (kể cả op nhận trong lúc nạp, kể cả op của
   * mình). Trong log có `reload` mới hơn (ai đó đổi cấu trúc trong lúc mình đang chờ) ⇒ nạp bản đó thay.
   */
  private loadAndReplay(versionSeq: number | null, atSeq: number, renames?: Record<string, string>): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
    if (this.view.phase === 'live') for (const n of this.pending.keys()) this.reapply.add(n);
    this.setView({ phase: 'syncing' });
    this.loading = this.loading.then(async () => {
      let version = versionSeq;
      let at = atSeq;
      let rn = renames;
      const newer = [...this.log].reverse().find((l) => l.op.kind === 'reload' && l.seq > at);
      if (newer) {
        version = newer.op.versionSeq ?? null;
        at = newer.op.atSeq ?? newer.seq;
        rn = { ...rn, ...newer.op.renames };
      }
      // Log chỉ đầy đủ từ lúc vào phòng — op cần áp lại cũ hơn thế thì không dựng lại được, xin đồng bộ lại.
      if (at < this.logFrom && version !== null) {
        this.send?.({ type: 'resync' });
        this.startSyncWait();
        return;
      }
      try {
        await this.editor.reload(version);
        if (version !== null) this.knownVersionSeq = version;
        else this.knownVersionSeq = await this.editor.latestVersionSeq().catch(() => null);
      } catch {
        // Không nạp được phiên bản (mạng) — áp lại trên trạng thái hiện có còn hơn treo.
      }
      if (rn) Object.assign(this.renames, rn);
      for (const { seq, op } of this.log) {
        if (seq > at && !op.kind) this.apply(op);
      }
      if (this.send) this.setView({ phase: 'live' });
    });
  }

  /** Máy này được nhờ làm nguồn: đợi op của mình được xếp hết, lưu, rồi báo snapshot. */
  private async serveSnapshot(): Promise<void> {
    await this.untilNoPending();
    let atSeq = this.lastSeq;
    try {
      const versionSeq = await this.editor.snapshot(() => (atSeq = this.lastSeq));
      this.knownVersionSeq = versionSeq;
      this.send?.({ type: 'snapshot', versionSeq, atSeq });
    } catch {
      // Lưu hỏng: máy đang chờ sẽ tự nạp bản mới nhất sau SYNC_TIMEOUT_MS.
    }
  }

  private async publishStructure(): Promise<void> {
    this.structureTimer = null;
    const renames = this.structureRenames;
    this.structureRenames = {};
    if (this.view.phase !== 'live') return;
    await this.untilNoPending();
    let atSeq = this.lastSeq;
    try {
      const versionSeq = await this.editor.snapshot(() => (atSeq = this.lastSeq));
      this.knownVersionSeq = versionSeq;
      Object.assign(this.renames, renames);
      this.send?.({ type: 'op', op: { kind: 'reload', versionSeq, atSeq, renames, cid: this.cid, n: ++this.n } });
    } catch {
      // Lưu hỏng: thay đổi vẫn ở máy này, lần thay đổi cấu trúc sau sẽ thử lại.
    }
  }

  private async untilNoPending(): Promise<void> {
    const until = Date.now() + PENDING_WAIT_MS;
    while (this.pending.size > 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
  }

  private clearTimers(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.structureTimer) clearTimeout(this.structureTimer);
    this.syncTimer = null;
    this.structureTimer = null;
  }

  private setView(patch: Partial<CollabView>): void {
    this.view = { ...this.view, ...patch };
    this.onView(this.view);
  }
}
