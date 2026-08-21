#!/usr/bin/env node
/**
 * Sửa `File.fileName` bị hỏng dấu (mojibake) của các bản ghi lưu TRƯỚC bản vá upload.
 *
 * Gốc lỗi: multer trả `originalname` dạng latin1, code cũ lưu thẳng chuỗi đó, nên
 * "Bài 10.pdf" thành "BÃ i 10.pdf". Bản vá đã decode đúng cho file mới; script này dọn dữ liệu cũ.
 *
 *   node scripts/fix-file-name-mojibake.mjs            # chạy thử, chỉ in ra, KHÔNG ghi
 *   node scripts/fix-file-name-mojibake.mjs --apply    # ghi thật
 *
 * Cần DATABASE_URL trong môi trường. Trên VPS:
 *   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
 *     --entrypoint sh api -c 'node /repo/scripts/fix-file-name-mojibake.mjs --apply'
 */
import { PrismaClient } from '@lms/database';

const APPLY = process.argv.includes('--apply');

/**
 * Trả về tên đã sửa, hoặc null nếu chuỗi này KHÔNG phải mojibake.
 *
 * Điều kiện an toàn — phải đúng cả ba, để không phá tên vốn đã đúng:
 *  1. Diễn giải lại bytes latin1 thành UTF-8 không sinh ký tự thay thế (U+FFFD).
 *  2. Mã hoá ngược lại phải khớp CHÍNH XÁC chuỗi gốc (nghĩa là chuỗi gốc đúng là bytes UTF-8
 *     bị đọc nhầm thành latin1, không phải trùng hợp).
 *  3. Kết quả thực sự khác chuỗi gốc (ASCII thuần sẽ không đổi -> bỏ qua).
 */
function repair(name) {
  const bytes = Buffer.from(name, 'latin1');
  const decoded = bytes.toString('utf8');
  if (decoded.includes('�')) return null;
  if (Buffer.from(decoded, 'utf8').toString('latin1') !== name) return null;
  return decoded === name ? null : decoded;
}

const prisma = new PrismaClient();

try {
  const files = await prisma.file.findMany({ select: { id: true, fileName: true } });
  const fixes = [];
  for (const file of files) {
    const fixed = repair(file.fileName);
    if (fixed) fixes.push({ id: file.id, from: file.fileName, to: fixed });
  }

  console.log(`Quét ${files.length} bản ghi File — ${fixes.length} tên cần sửa.`);
  for (const f of fixes) console.log(`  ${f.from}  ->  ${f.to}`);

  if (fixes.length === 0) {
    console.log('Không có gì để làm.');
  } else if (!APPLY) {
    console.log('\nChạy thử (dry-run). Thêm --apply để ghi thật.');
  } else {
    for (const f of fixes) {
      await prisma.file.update({ where: { id: f.id }, data: { fileName: f.to } });
    }
    console.log(`\nĐã cập nhật ${fixes.length} bản ghi.`);
  }
} finally {
  await prisma.$disconnect();
}
