import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollabClient, SYNC_TIMEOUT_MS, touchedIds, type CollabOp, type CollabView } from './collabClient';

const move = (blockId: string, newParentId?: string): CollabOp => ({
  target: 'Rex',
  e: { type: 'move', blockId, newParentId },
});

function setup(known: number | null = 3) {
  const applied: CollabOp[] = [];
  const reloads: (number | null)[] = [];
  const sent: Record<string, unknown>[] = [];
  let view: CollabView | null = null;
  const editor = {
    apply: vi.fn((op: CollabOp) => applied.push(op)),
    reload: vi.fn(async (v: number | null) => void reloads.push(v)),
    snapshot: vi.fn(async (onExport: () => void) => {
      onExport();
      return 9;
    }),
    latestVersionSeq: vi.fn(async () => known),
    remoteSaved: vi.fn(),
  };
  const client = new CollabClient(editor, (v) => (view = v), known);
  client.connected((m) => sent.push(m as Record<string, unknown>));
  const flush = () => vi.advanceTimersByTimeAsync(0);
  return { client, editor, applied, reloads, sent, view: () => view!, flush };
}

describe('CollabClient', () => {
  beforeEach(() => vi.useFakeTimers());

  it('touchedIds: khối, cha cũ/mới, biến, mọi id bị xóa kèm', () => {
    expect(
      touchedIds({ e: { blockId: 'a', newParentId: 'p', oldParentId: 'q', ids: ['a', 'c'], varId: 'v' } }),
    ).toEqual(['a', 'p', 'q', 'v', 'a', 'c']);
    expect(touchedIds({ kind: 'saved' })).toEqual([]);
  });

  it('vào phòng trống, bản đã lưu không đổi → live; op người khác được áp, op của mình không áp lại', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 4, needsSync: false, members: [], lead: true });
    await t.flush();
    expect(t.view().phase).toBe('live');
    t.client.localOp(move('a'));
    const mine = t.sent[0].op as CollabOp;
    t.client.handle({ type: 'op', seq: 5, op: mine });
    t.client.handle({ type: 'op', seq: 6, op: { ...move('b'), cid: 'other', n: 1 } });
    expect(t.applied.map((o) => o.e?.blockId)).toEqual(['b']);
  });

  it('nối lại một mình mà server đã có bản mới hơn → nạp bản mới nhất', async () => {
    const t = setup(3);
    t.editor.latestVersionSeq.mockResolvedValue(5);
    t.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: true });
    await t.flush();
    expect(t.reloads).toEqual([null]);
    expect(t.view().phase).toBe('live');
    expect(t.client.knownVersionSeq).toBe(5);
  });

  it('vào phòng có người: che tới khi có snapshot, rồi áp lại đúng các op sau atSeq (op nhận trong lúc chờ)', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 10, needsSync: true, members: [], lead: false });
    expect(t.view().phase).toBe('syncing');
    t.client.localOp(move('x')); // đang che — không gửi
    expect(t.sent).toEqual([]);
    t.client.handle({ type: 'op', seq: 11, op: { ...move('a'), cid: 'o', n: 1 } });
    t.client.handle({ type: 'op', seq: 12, op: { ...move('b'), cid: 'o', n: 2 } });
    expect(t.applied).toEqual([]);
    t.client.handle({ type: 'snapshot', versionSeq: 7, atSeq: 11 });
    await t.flush();
    expect(t.reloads).toEqual([7]);
    expect(t.applied.map((o) => o.e?.blockId)).toEqual(['b']);
    expect(t.view().phase).toBe('live');
    expect(t.client.knownVersionSeq).toBe(7);
  });

  it('snapshot không tới (nguồn lưu hỏng) → hết giờ tự nạp bản mới nhất', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 1, needsSync: true, members: [], lead: false });
    await vi.advanceTimersByTimeAsync(SYNC_TIMEOUT_MS);
    expect(t.reloads).toEqual([null]);
    expect(t.view().phase).toBe('live');
  });

  it('xung đột: op người khác đụng khối mình đang chờ xác nhận → xin đồng bộ lại, không áp; op mình gửi trước đó được áp lại sau khi nạp', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: true });
    await t.flush();
    t.client.localOp(move('a', 'p1'));
    const mine = t.sent[0].op as CollabOp;
    // Người khác kéo CÙNG khối a vào p2 và được xếp TRƯỚC.
    t.client.handle({ type: 'op', seq: 1, op: { ...move('a', 'p2'), cid: 'o', n: 1 } });
    expect(t.sent[1]).toEqual({ type: 'resync' });
    expect(t.applied).toEqual([]);
    expect(t.view().phase).toBe('syncing');
    t.client.handle({ type: 'op', seq: 2, op: mine });
    t.client.handle({ type: 'snapshot', versionSeq: 8, atSeq: 1 });
    await t.flush();
    // Bản 8 = trạng thái đúng ở seq 1; op của mình (seq 2) áp lại sau → cả phòng cùng kết quả "a vào p1".
    expect(t.applied).toEqual([mine]);
  });

  it('op khác khối không bị coi là xung đột', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: true });
    await t.flush();
    t.client.localOp(move('a', 'p1'));
    t.client.handle({ type: 'op', seq: 1, op: { ...move('b', 'p9'), cid: 'o', n: 1 } });
    expect(t.sent).toHaveLength(1);
    expect(t.applied.map((o) => o.e?.blockId)).toEqual(['b']);
  });

  it('được nhờ làm nguồn: đợi op của mình được xác nhận rồi mới lưu, báo snapshot với atSeq lúc xuất', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: true });
    await t.flush();
    t.client.localOp(move('a'));
    const mine = t.sent[0].op as CollabOp;
    t.client.handle({ type: 'sync-request' });
    await vi.advanceTimersByTimeAsync(200);
    expect(t.editor.snapshot).not.toHaveBeenCalled();
    t.client.handle({ type: 'op', seq: 1, op: mine });
    await vi.advanceTimersByTimeAsync(100);
    expect(t.sent.at(-1)).toEqual({ type: 'snapshot', versionSeq: 9, atSeq: 1 });
  });

  it('đổi cấu trúc: gộp, lưu, phát reload; máy khác nạp bản đó và áp đúng tên mới', async () => {
    const a = setup();
    a.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: true });
    await a.flush();
    a.client.structureChanged({ Rex: 'Rex xanh' });
    a.client.structureChanged({});
    await vi.advanceTimersByTimeAsync(1600);
    expect(a.editor.snapshot).toHaveBeenCalledTimes(1);
    const reload = a.sent.at(-1)!.op as CollabOp;
    expect(reload).toMatchObject({ kind: 'reload', versionSeq: 9, atSeq: 0, renames: { Rex: 'Rex xanh' } });

    const b = setup();
    b.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: false });
    await b.flush();
    b.client.handle({ type: 'op', seq: 1, op: reload });
    // Op cũ (gửi trước khi người kia biết tên mới) vẫn nhắm "Rex".
    b.client.handle({ type: 'op', seq: 2, op: { ...move('z'), cid: 'o', n: 5 } });
    await b.flush();
    expect(b.reloads).toEqual([9]);
    expect(b.applied).toEqual([{ ...move('z'), cid: 'o', n: 5, target: 'Rex xanh' }]);
    // Máy tạo ra reload không tự nạp lại.
    a.client.handle({ type: 'op', seq: 1, op: reload });
    await a.flush();
    expect(a.reloads).toEqual([]);
  });

  it('người lưu chính lưu xong → phát saved; máy khác không còn op chờ thì hạ "chưa lưu"', async () => {
    const t = setup();
    t.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: true });
    await t.flush();
    t.client.saved(11);
    expect(t.sent.at(-1)!.op).toMatchObject({ kind: 'saved', versionSeq: 11 });
    const other = setup();
    other.client.handle({ type: 'joined', seq: 0, needsSync: false, members: [], lead: false });
    await other.flush();
    other.client.saved(12); // không phải người lưu chính → không phát
    expect(other.sent).toEqual([]);
    other.client.handle({ type: 'op', seq: 1, op: t.sent.at(-1)!.op as CollabOp });
    expect(other.editor.remoteSaved).toHaveBeenCalled();
    expect(other.client.knownVersionSeq).toBe(11);
  });

  it('rớt mạng → offline (che); bị gỡ → ended, không nối lại', () => {
    const t = setup();
    t.client.disconnected(1006, false);
    expect(t.view()).toMatchObject({ phase: 'offline', lead: false });
    t.client.disconnected(4003, true);
    expect(t.view()).toMatchObject({ phase: 'ended', endCode: 4003 });
  });
});
