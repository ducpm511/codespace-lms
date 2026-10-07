/**
 * Phòng làm chung BlockSpace (ADR 003 D5′) — giữ TRONG RAM tiến trình API, không I/O, test được độc lập.
 *
 * Server giữ thứ tự (authoritative sequencing): mỗi op được gán `seq` tăng dần TRONG PHÒNG rồi phát cho MỌI
 * thành viên, kể cả người gửi (người gửi nhận lại = xác nhận thứ tự). Server KHÔNG hiểu nội dung op.
 *
 * Đồng bộ trạng thái (T11.6b): server không chạy được Scratch VM nên không tự dựng được dự án. Thay vào đó
 * một máy ĐÚNG trong phòng ("nguồn") lưu phiên bản (HTTP như autosave) rồi báo `snapshot {versionSeq, atSeq}`;
 * máy cần đồng bộ nạp phiên bản đó rồi áp lại các op có seq > atSeq mà nó đã nhận. Cần đồng bộ khi:
 * - vào phòng đang có người (bản đã lưu có thể cũ hơn trạng thái phòng);
 * - client tự phát hiện lệch (op của mình và op người khác đụng cùng khối) → `resync`.
 * Không còn máy đúng nào (mọi người đều đang chờ đồng bộ) ⇒ tất cả nạp lại bản đã lưu mới nhất.
 *
 * Người lưu chính (`leader`): thành viên vào sớm nhất mà không đang chờ đồng bộ — CHỈ máy này tự lưu, tránh
 * 6 máy cùng ghi 6 phiên bản giống nhau. Phòng trống thì xóa ngay — RAM chỉ theo phòng ĐANG có người.
 */

export const COLLAB_MAX_MEMBERS = 6;
/** Op lớn nhất (byte JSON). Một sự kiện khối Scratch thường < 2 KB; tạo khối lớn (dán cả đoạn) ~ vài chục KB. */
export const COLLAB_MAX_OP_BYTES = 64 * 1024;

export interface CollabMember<C> {
  conn: C;
  userId: string;
  name: string;
}

interface MemberState<C> extends CollabMember<C> {
  needsSync: boolean;
  /** seq phòng lúc bắt đầu cần đồng bộ — snapshot phải có atSeq ≥ số này mới đủ. */
  syncFrom: number;
}

export interface SequencedOp {
  seq: number;
  from: string;
  op: unknown;
}

interface Room<C> {
  seq: number;
  /** Map giữ thứ tự chèn = thứ tự vào phòng. */
  members: Map<C, MemberState<C>>;
  /** Máy đang được nhờ gửi snapshot (null = không có việc đồng bộ nào đang chạy). */
  syncSource: C | null;
}

export type JoinResult =
  { ok: true; seq: number; needsSync: boolean; members: CollabMember<unknown>[] } | { ok: false; reason: 'full' };

/** Việc gateway phải làm sau một thay đổi: nhờ `source` gửi snapshot, và/hoặc bảo `reloadLatest` nạp bản đã lưu. */
export interface SyncPlan<C> {
  source: C | null;
  reloadLatest: C[];
}

export class CollabRooms<C> {
  private readonly rooms = new Map<string, Room<C>>();

  join(projectId: string, member: CollabMember<C>): JoinResult {
    let room = this.rooms.get(projectId);
    if (!room) {
      room = { seq: 0, members: new Map(), syncSource: null };
      this.rooms.set(projectId, room);
    }
    if (room.members.has(member.conn)) return { ok: false, reason: 'full' };
    if (room.members.size >= COLLAB_MAX_MEMBERS) return { ok: false, reason: 'full' };
    // Phòng đang có người ⇒ trạng thái phòng có thể mới hơn bản đã lưu mà máy này vừa nạp.
    const needsSync = room.members.size > 0;
    room.members.set(member.conn, { ...member, needsSync, syncFrom: room.seq });
    return { ok: true, seq: room.seq, needsSync, members: this.members(projectId) };
  }

  /** Rời phòng; trả thành viên còn lại (để báo presence), phòng trống thì xóa. */
  leave(projectId: string, conn: C): CollabMember<C>[] {
    const room = this.rooms.get(projectId);
    if (!room) return [];
    room.members.delete(conn);
    if (room.syncSource === conn) room.syncSource = null;
    if (room.members.size === 0) {
      this.rooms.delete(projectId);
      return [];
    }
    return this.members(projectId);
  }

  /** Gán seq. Người gửi phải đang ở trong phòng. */
  sequence(projectId: string, conn: C, op: unknown): { entry: SequencedOp; to: C[] } | null {
    const room = this.rooms.get(projectId);
    const member = room?.members.get(conn);
    if (!room || !member) return null;
    room.seq += 1;
    return { entry: { seq: room.seq, from: member.userId, op }, to: [...room.members.keys()] };
  }

  /** Client báo trạng thái của nó đã lệch. Ở một mình thì không có gì để lệch với ai ⇒ false. */
  requestResync(projectId: string, conn: C): boolean {
    const room = this.rooms.get(projectId);
    const member = room?.members.get(conn);
    if (!room || !member || room.members.size < 2) return false;
    member.needsSync = true;
    member.syncFrom = room.seq;
    if (room.syncSource === conn) room.syncSource = null;
    return true;
  }

  /**
   * Bắt đầu đồng bộ nếu có người đang chờ mà chưa ai được nhờ: nguồn = thành viên vào sớm nhất KHÔNG chờ
   * đồng bộ. Không còn ai đúng ⇒ mọi người nạp lại bản đã lưu (hết chờ).
   */
  planSync(projectId: string): SyncPlan<C> {
    const plan: SyncPlan<C> = { source: null, reloadLatest: [] };
    const room = this.rooms.get(projectId);
    if (!room || room.syncSource !== null) return plan;
    const all = [...room.members.values()];
    if (!all.some((m) => m.needsSync)) return plan;
    const source = all.find((m) => !m.needsSync);
    if (source) {
      room.syncSource = source.conn;
      plan.source = source.conn;
      return plan;
    }
    for (const m of all) m.needsSync = false;
    plan.reloadLatest = all.map((m) => m.conn);
    return plan;
  }

  /**
   * Nguồn báo đã lưu snapshot ở `atSeq`. Chỉ nhận từ đúng nguồn đang được nhờ. Trả những máy được snapshot
   * này đồng bộ (đang chờ, và atSeq đủ mới) — gateway chuyển snapshot cho đúng họ.
   */
  snapshot(projectId: string, conn: C, atSeq: number): C[] | null {
    const room = this.rooms.get(projectId);
    if (!room || room.syncSource !== conn || atSeq > room.seq) return null;
    room.syncSource = null;
    const to: C[] = [];
    for (const m of room.members.values()) {
      if (m.needsSync && m.syncFrom <= atSeq) {
        m.needsSync = false;
        to.push(m.conn);
      }
    }
    return to;
  }

  /** Người lưu chính: vào sớm nhất mà không đang chờ đồng bộ (không có thì người vào sớm nhất). */
  leader(projectId: string): C | null {
    const all = [...(this.rooms.get(projectId)?.members.values() ?? [])];
    return (all.find((m) => !m.needsSync) ?? all[0])?.conn ?? null;
  }

  members(projectId: string): CollabMember<C>[] {
    return [...(this.rooms.get(projectId)?.members.values() ?? [])].map(({ conn, userId, name }) => ({
      conn,
      userId,
      name,
    }));
  }

  /** Mọi kết nối của một người trong phòng (để đá khi mất quyền). */
  connsOf(projectId: string, userId: string): C[] {
    return this.members(projectId)
      .filter((m) => m.userId === userId)
      .map((m) => m.conn);
  }

  /** Số đo cho giám sát. */
  stats(): { rooms: number; members: number } {
    let members = 0;
    for (const room of this.rooms.values()) members += room.members.size;
    return { rooms: this.rooms.size, members };
  }
}
