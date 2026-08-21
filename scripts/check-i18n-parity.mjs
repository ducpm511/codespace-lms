#!/usr/bin/env node
/**
 * Đối chiếu bộ key giữa vi.json và en.json.
 *
 * Thiếu key ở một bên nghĩa là học viên/giáo viên sẽ thấy chuỗi khoá thô kiểu `admin.pageOf`
 * trên màn hình — lỗi này không bao giờ làm test đỏ, chỉ lộ ra khi có người nhìn thấy.
 * Chạy trong CI để nó đỏ trước.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, '../apps/web/src/i18n');

/** Trả về tập key dạng phẳng 'a.b.c'. */
function flatten(value, prefix = '', out = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

const load = (name) => flatten(JSON.parse(readFileSync(resolve(dir, name), 'utf8')));

const vi = load('vi.json');
const en = load('en.json');

const missingInEn = [...vi].filter((k) => !en.has(k)).sort();
const missingInVi = [...en].filter((k) => !vi.has(k)).sort();

if (missingInEn.length === 0 && missingInVi.length === 0) {
  console.log(`i18n parity OK — ${vi.size}/${en.size} key.`);
  process.exit(0);
}

if (missingInEn.length > 0) {
  console.error(`Thiếu trong en.json (${missingInEn.length}):`);
  for (const k of missingInEn) console.error(`  - ${k}`);
}
if (missingInVi.length > 0) {
  console.error(`Thiếu trong vi.json (${missingInVi.length}):`);
  for (const k of missingInVi) console.error(`  - ${k}`);
}
process.exit(1);
