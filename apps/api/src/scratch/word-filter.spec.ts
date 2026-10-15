import { containsBanned, normalizeBannedWord, tokenize } from './word-filter';

const BANNED = ['lồn', 'cặc', 'đm', 'óc chó', 'fuck'];

describe('word-filter', () => {
  it('khớp từ nguyên vẹn, bỏ qua hoa/thường + dấu câu xung quanh', () => {
    expect(containsBanned('ĐM, sao khó thế!', BANNED)).toBe(true);
    expect(containsBanned('what the FUCK?', BANNED)).toBe(true);
  });

  it('giữ dấu tiếng Việt: không chặn nhầm từ bình thường', () => {
    expect(containsBanned('Cái lon nước của Rex', BANNED)).toBe(false);
    expect(containsBanned('Các bạn xem mê cung nhé', BANNED)).toBe(false);
    expect(containsBanned('fuckup', BANNED)).toBe(false); // không khớp chuỗi con
  });

  it('cụm từ chỉ khớp khi các từ đứng liền nhau', () => {
    expect(containsBanned('đồ óc   chó!', BANNED)).toBe(true);
    expect(containsBanned('con chó có óc thông minh', BANNED)).toBe(false);
  });

  it('NFD (gõ dấu tổ hợp) cũng khớp', () => {
    expect(containsBanned('lồn'.normalize('NFD'), BANNED)).toBe(true);
  });

  it('chuẩn hóa từ admin nhập; chỉ dấu câu ⇒ null', () => {
    expect(normalizeBannedWord('  Óc   CHÓ ')).toBe('óc chó');
    expect(normalizeBannedWord('!!!')).toBeNull();
    expect(tokenize('Rex-123 đi!')).toEqual(['rex', '123', 'đi']);
  });
});
