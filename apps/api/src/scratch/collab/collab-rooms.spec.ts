import { COLLAB_MAX_MEMBERS, CollabRooms } from './collab-rooms';

const member = (conn: string, userId = conn) => ({ conn, userId, name: userId });

describe('CollabRooms', () => {
  let rooms: CollabRooms<string>;
  beforeEach(() => (rooms = new CollabRooms<string>()));

  it('gán seq tăng dần trong phòng, phát cho MỌI thành viên kể cả người gửi', () => {
    rooms.join('p1', member('a'));
    rooms.join('p1', member('b'));
    expect(rooms.sequence('p1', 'a', { k: 1 })).toEqual({
      entry: { seq: 1, from: 'a', op: { k: 1 } },
      to: ['a', 'b'],
    });
    expect(rooms.sequence('p1', 'b', { k: 2 })?.entry.seq).toBe(2);
  });

  it('seq độc lập giữa các phòng', () => {
    rooms.join('p1', member('a'));
    rooms.join('p2', member('b'));
    rooms.sequence('p1', 'a', 1);
    expect(rooms.sequence('p2', 'b', 1)?.entry.seq).toBe(1);
  });

  it('người không ở trong phòng không gửi op được', () => {
    rooms.join('p1', member('a'));
    expect(rooms.sequence('p1', 'x', 1)).toBeNull();
    expect(rooms.sequence('p9', 'a', 1)).toBeNull();
  });

  it(`tối đa ${COLLAB_MAX_MEMBERS} kết nối / phòng`, () => {
    for (let i = 0; i < COLLAB_MAX_MEMBERS; i++) expect(rooms.join('p1', member(`c${i}`)).ok).toBe(true);
    expect(rooms.join('p1', member('late'))).toEqual({ ok: false, reason: 'full' });
    rooms.leave('p1', 'c0');
    expect(rooms.join('p1', member('late')).ok).toBe(true);
  });

  it('vào phòng trống: không cần đồng bộ; vào phòng có người: cần đồng bộ, nguồn = người vào sớm nhất', () => {
    expect(rooms.join('p1', member('a'))).toMatchObject({ ok: true, needsSync: false });
    rooms.sequence('p1', 'a', 'x');
    expect(rooms.join('p1', member('b'))).toMatchObject({ ok: true, needsSync: true, seq: 1 });
    expect(rooms.planSync('p1')).toEqual({ source: 'a', reloadLatest: [] });
    // Đang nhờ a rồi — không nhờ lần nữa.
    expect(rooms.planSync('p1')).toEqual({ source: null, reloadLatest: [] });
  });

  it('snapshot chỉ nhận từ đúng nguồn, chỉ đồng bộ máy có syncFrom ≤ atSeq', () => {
    rooms.join('p1', member('a'));
    rooms.sequence('p1', 'a', 'x');
    rooms.join('p1', member('b')); // syncFrom 1
    rooms.planSync('p1');
    expect(rooms.snapshot('p1', 'b', 1)).toBeNull(); // b không phải nguồn
    expect(rooms.snapshot('p1', 'a', 5)).toBeNull(); // atSeq vượt seq phòng
    expect(rooms.snapshot('p1', 'a', 1)).toEqual(['b']);
    expect(rooms.planSync('p1')).toEqual({ source: null, reloadLatest: [] });
  });

  it('nguồn rời giữa chừng → nhờ người khác; không còn ai đúng → mọi người nạp lại bản đã lưu', () => {
    rooms.join('p1', member('a'));
    rooms.join('p1', member('b'));
    rooms.join('p1', member('c'));
    expect(rooms.planSync('p1').source).toBe('a');
    rooms.leave('p1', 'a');
    // b, c đều đang chờ ⇒ không ai đúng.
    expect(rooms.planSync('p1')).toEqual({ source: null, reloadLatest: ['b', 'c'] });
    expect(rooms.planSync('p1')).toEqual({ source: null, reloadLatest: [] });
  });

  it('resync: máy lệch được đồng bộ lại từ máy khác; ở một mình thì không cần', () => {
    rooms.join('p1', member('a'));
    expect(rooms.requestResync('p1', 'a')).toBe(false);
    rooms.join('p1', member('b'));
    rooms.snapshot('p1', 'a', 0); // chưa nhờ ⇒ bỏ qua
    rooms.planSync('p1');
    rooms.snapshot('p1', 'a', 0);
    // a (người lưu chính) tự thấy lệch → nguồn là b, và trong lúc chờ b lên làm người lưu chính.
    expect(rooms.leader('p1')).toBe('a');
    expect(rooms.requestResync('p1', 'a')).toBe(true);
    expect(rooms.leader('p1')).toBe('b');
    expect(rooms.planSync('p1').source).toBe('b');
    expect(rooms.snapshot('p1', 'b', 0)).toEqual(['a']);
    expect(rooms.leader('p1')).toBe('a');
  });

  it('phòng trống bị xóa ngay — RAM chỉ theo phòng đang có người', () => {
    rooms.join('p1', member('a'));
    rooms.join('p1', member('a2', 'a'));
    expect(rooms.connsOf('p1', 'a')).toEqual(['a', 'a2']);
    expect(rooms.stats()).toEqual({ rooms: 1, members: 2 });
    rooms.leave('p1', 'a');
    rooms.leave('p1', 'a2');
    expect(rooms.stats()).toEqual({ rooms: 0, members: 0 });
  });
});
