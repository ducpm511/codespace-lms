import { COLLAB_BUFFER_OPS, COLLAB_MAX_MEMBERS, CollabRooms } from './collab-rooms';

const member = (conn: string, userId = conn) => ({ conn, userId, name: userId });

describe('CollabRooms', () => {
  let rooms: CollabRooms<string>;
  beforeEach(() => (rooms = new CollabRooms<string>()));

  it('gán seq tăng dần trong phòng, phát cho MỌI thành viên kể cả người gửi', () => {
    rooms.join('p1', member('a'));
    rooms.join('p1', member('b'));
    expect(rooms.sequence('p1', 'a', { k: 1 }, 10)).toEqual({
      entry: { seq: 1, from: 'a', op: { k: 1 } },
      to: ['a', 'b'],
    });
    expect(rooms.sequence('p1', 'b', { k: 2 }, 10)?.entry.seq).toBe(2);
  });

  it('seq độc lập giữa các phòng', () => {
    rooms.join('p1', member('a'));
    rooms.join('p2', member('b'));
    rooms.sequence('p1', 'a', 1, 1);
    expect(rooms.sequence('p2', 'b', 1, 1)?.entry.seq).toBe(1);
  });

  it('người không ở trong phòng không gửi op được', () => {
    rooms.join('p1', member('a'));
    expect(rooms.sequence('p1', 'x', 1, 1)).toBeNull();
    expect(rooms.sequence('p9', 'a', 1, 1)).toBeNull();
  });

  it(`tối đa ${COLLAB_MAX_MEMBERS} kết nối / phòng`, () => {
    for (let i = 0; i < COLLAB_MAX_MEMBERS; i++) expect(rooms.join('p1', member(`c${i}`)).ok).toBe(true);
    expect(rooms.join('p1', member('late'))).toEqual({ ok: false, reason: 'full' });
    rooms.leave('p1', 'c0');
    expect(rooms.join('p1', member('late')).ok).toBe(true);
  });

  it('nối lại: trả các op sau sinceSeq; quá cũ (đã rơi khỏi bộ đệm) → null = nạp lại dự án', () => {
    rooms.join('p1', member('a'));
    for (let i = 0; i < COLLAB_BUFFER_OPS + 5; i++) rooms.sequence('p1', 'a', i, 1);
    const recent = rooms.join('p1', member('b'), COLLAB_BUFFER_OPS + 2);
    expect(recent.ok && recent.catchUp?.map((e) => e.seq)).toEqual([
      COLLAB_BUFFER_OPS + 3,
      COLLAB_BUFFER_OPS + 4,
      COLLAB_BUFFER_OPS + 5,
    ]);
    const stale = rooms.join('p1', member('c'), 1);
    expect(stale.ok && stale.catchUp).toBeNull();
    const fresh = rooms.join('p1', member('d'));
    expect(fresh.ok && fresh.catchUp).toEqual([]);
  });

  it('phòng trống bị xóa ngay — RAM chỉ theo phòng đang có người', () => {
    rooms.join('p1', member('a'));
    rooms.sequence('p1', 'a', 'x', 100);
    expect(rooms.stats()).toEqual({ rooms: 1, members: 1, bufferedOps: 1, bufferedBytes: 100 });
    rooms.leave('p1', 'a');
    expect(rooms.stats()).toEqual({ rooms: 0, members: 0, bufferedOps: 0, bufferedBytes: 0 });
  });
});
