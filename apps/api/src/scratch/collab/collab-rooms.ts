/**
 * Phòng làm chung BlockSpace (ADR 003 D5′) — giữ TRONG RAM tiến trình API, không I/O, test được độc lập.
 *
 * Server giữ thứ tự (authoritative sequencing): mỗi op được gán `seq` tăng dần TRONG PHÒNG rồi phát cho MỌI
 * thành viên, kể cả người gửi (người gửi nhận lại = xác nhận thứ tự). Phòng giữ một bộ đệm op gần nhất để
 * máy rớt mạng nối lại được mà không phải nạp lại cả dự án; quá cũ thì bảo client nạp lại (`resync`).
 * Phòng trống thì xóa ngay — RAM chỉ tỉ lệ với số phòng ĐANG có người.
 */

export const COLLAB_MAX_MEMBERS = 6;
/** Op lớn nhất (byte JSON). Một sự kiện khối Scratch thường < 2 KB; tạo khối lớn (dán cả đoạn) ~ vài chục KB. */
export const COLLAB_MAX_OP_BYTES = 64 * 1024;
/** Bộ đệm nối lại: tối đa ngần này op HOẶC ngần này byte mỗi phòng (cái nào chạm trước). */
export const COLLAB_BUFFER_OPS = 500;
export const COLLAB_BUFFER_BYTES = 1024 * 1024;

export interface CollabMember<C> {
  conn: C;
  userId: string;
  name: string;
}

export interface SequencedOp {
  seq: number;
  from: string;
  op: unknown;
}

interface Room<C> {
  seq: number;
  members: Map<C, CollabMember<C>>;
  buffer: { entry: SequencedOp; bytes: number }[];
  bufferBytes: number;
}

export type JoinResult =
  | { ok: true; seq: number; catchUp: SequencedOp[] | null; members: CollabMember<unknown>[] }
  | { ok: false; reason: 'full' };

export class CollabRooms<C> {
  private readonly rooms = new Map<string, Room<C>>();

  /**
   * Vào phòng. `sinceSeq`: số op cuối client đã có (nối lại) → trả các op sau đó; `catchUp: null` = bộ đệm
   * không còn đủ, client phải nạp lại dự án.
   */
  join(projectId: string, member: CollabMember<C>, sinceSeq?: number): JoinResult {
    let room = this.rooms.get(projectId);
    if (!room) {
      room = { seq: 0, members: new Map(), buffer: [], bufferBytes: 0 };
      this.rooms.set(projectId, room);
    }
    if (!room.members.has(member.conn) && room.members.size >= COLLAB_MAX_MEMBERS) {
      return { ok: false, reason: 'full' };
    }
    room.members.set(member.conn, member);
    let catchUp: SequencedOp[] | null = [];
    if (sinceSeq !== undefined && sinceSeq < room.seq) {
      const oldest = room.buffer[0]?.entry.seq ?? room.seq + 1;
      catchUp = sinceSeq + 1 >= oldest ? room.buffer.filter((b) => b.entry.seq > sinceSeq).map((b) => b.entry) : null;
    }
    return { ok: true, seq: room.seq, catchUp, members: [...room.members.values()] };
  }

  /** Rời phòng; trả thành viên còn lại (để báo presence), phòng trống thì xóa. */
  leave(projectId: string, conn: C): CollabMember<C>[] {
    const room = this.rooms.get(projectId);
    if (!room) return [];
    room.members.delete(conn);
    if (room.members.size === 0) {
      this.rooms.delete(projectId);
      return [];
    }
    return [...room.members.values()];
  }

  /** Gán seq + lưu đệm. Người gửi phải đang ở trong phòng. */
  sequence(projectId: string, conn: C, op: unknown, bytes: number): { entry: SequencedOp; to: C[] } | null {
    const room = this.rooms.get(projectId);
    const member = room?.members.get(conn);
    if (!room || !member) return null;
    room.seq += 1;
    const entry: SequencedOp = { seq: room.seq, from: member.userId, op };
    room.buffer.push({ entry, bytes });
    room.bufferBytes += bytes;
    while (room.buffer.length > COLLAB_BUFFER_OPS || room.bufferBytes > COLLAB_BUFFER_BYTES) {
      room.bufferBytes -= room.buffer.shift()!.bytes;
    }
    return { entry, to: [...room.members.keys()] };
  }

  members(projectId: string): CollabMember<C>[] {
    return [...(this.rooms.get(projectId)?.members.values() ?? [])];
  }

  /** Số đo cho spike / giám sát. */
  stats(): { rooms: number; members: number; bufferedOps: number; bufferedBytes: number } {
    let members = 0;
    let bufferedOps = 0;
    let bufferedBytes = 0;
    for (const room of this.rooms.values()) {
      members += room.members.size;
      bufferedOps += room.buffer.length;
      bufferedBytes += room.bufferBytes;
    }
    return { rooms: this.rooms.size, members, bufferedOps, bufferedBytes };
  }
}
