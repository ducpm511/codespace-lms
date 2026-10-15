/**
 * Lọc từ cấm trong bình luận BlockSpace (T11.8 — ADR D8). Khớp theo TỪ NGUYÊN VẸN, giữ dấu tiếng Việt:
 * "lồn" chặn "lồn" nhưng không chặn "lon" (cái lon), "cặc" không chặn "các". Cụm từ ("óc chó") khớp khi các
 * từ đứng liền nhau. Bỏ qua hoa/thường và dấu câu xen giữa ("Đ.M" → "đ m" không khớp "đm" — chấp nhận: lọc
 * cơ bản, GV vẫn ẩn/xóa được và học viên báo cáo được).
 */

/** Chuẩn hóa để so: NFC + chữ thường. */
function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

/** Tách thành các từ (chữ cái / số Unicode). */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Chuẩn hóa từ cấm admin nhập: chữ thường, NFC, các từ cách nhau một khoảng trắng. Trả null nếu không có chữ
 * nào (chỉ dấu câu / khoảng trắng) — không lưu được.
 */
export function normalizeBannedWord(input: string): string | null {
  const tokens = tokenize(input);
  return tokens.length ? tokens.join(' ') : null;
}

/** Có chứa từ / cụm từ cấm nào không. `banned` đã chuẩn hóa (normalizeBannedWord). */
export function containsBanned(text: string, banned: readonly string[]): boolean {
  const tokens = tokenize(text);
  if (tokens.length === 0) return false;
  const single = new Set<string>();
  const phrases: string[][] = [];
  for (const w of banned) {
    const parts = w.split(' ');
    if (parts.length === 1) single.add(parts[0]);
    else phrases.push(parts);
  }
  if (tokens.some((t) => single.has(t))) return true;
  return phrases.some((p) => tokens.some((_, i) => p.every((part, j) => tokens[i + j] === part)));
}
