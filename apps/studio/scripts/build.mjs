// Build BlockSpace → apps/studio/dist (phục vụ tại /studio/editor/ bởi apps/web).
// SPDX-License-Identifier: AGPL-3.0-only
//
// Trình soạn được build TỪ MÃ NGUỒN (scratch-editor + editor/patches, xem build-editor.mjs) thành
// tarball `blockspace-editor-<ver>.tgz`. Build cỡ 10–20 phút nên không chạy lại mỗi lần build LMS:
// 1. Có tarball trong .cache/ (vừa chạy build:editor trên máy này) → dùng luôn.
// 2. Không có → tải bản đã phát hành trên GitHub Releases của repo LMS, kiểm sha512 đã ghim.
// Sau đó chép bridge.js + index.html (gắn tên bundle có hash) + logo + giấy phép.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EDITOR, RELEASE, SOURCE_URL } from './editor-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const DIST = join(ROOT, 'dist');
const TARBALL = join(CACHE, `blockspace-editor-${EDITOR.version}.tgz`);

function sha512(file) {
  return 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64');
}

async function editorTarball() {
  if (existsSync(TARBALL)) {
    const digest = sha512(TARBALL);
    if (RELEASE.integrity && digest !== RELEASE.integrity) {
      console.warn(`[studio] dùng bản build cục bộ .cache/${basename(TARBALL)} (khác bản phát hành đã ghim)`);
    }
    return TARBALL;
  }
  if (!RELEASE.integrity) {
    throw new Error(
      `Chưa có bản phát hành của trình soạn ${EDITOR.version}: chạy \`pnpm --filter @lms/studio build:editor\` ` +
        'hoặc phát hành qua workflow "BlockSpace editor" rồi ghim RELEASE.integrity (editor-config.mjs).',
    );
  }
  mkdirSync(CACHE, { recursive: true });
  console.log(`[studio] tải ${RELEASE.url}`);
  const res = await fetch(RELEASE.url);
  if (!res.ok) throw new Error(`Tải trình soạn lỗi HTTP ${res.status}`);
  const tmp = `${TARBALL}.part`;
  writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  const digest = sha512(tmp);
  if (digest !== RELEASE.integrity) {
    rmSync(tmp);
    throw new Error(`Trình soạn sai mã băm (${digest}), cần ${RELEASE.integrity}`);
  }
  cpSync(tmp, TARBALL);
  rmSync(tmp);
  return TARBALL;
}

function dirStats(dir) {
  let bytes = 0;
  let files = 0;
  for (const name of readdirSync(dir, { recursive: true })) {
    const s = statSync(join(dir, name));
    if (s.isFile()) {
      bytes += s.size;
      files += 1;
    }
  }
  return { bytes, files };
}

const started = Date.now();
const tarball = await editorTarball();
rmSync(DIST, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); // Windows: dev server có thể đang giữ file
mkdirSync(DIST, { recursive: true });
// Đường dẫn tương đối + cwd: GNU tar (Git Bash) hiểu "D:\..." là máy chủ "D".
execFileSync('tar', ['-xzf', join('..', '.cache', basename(tarball)), '-C', '.'], { cwd: DIST, stdio: 'inherit' });
const { bytes, files } = dirStats(DIST);

const editor = JSON.parse(readFileSync(join(DIST, 'editor.json'), 'utf8'));
const html = readFileSync(join(ROOT, 'src', 'index.html'), 'utf8');
if (!html.includes('%EDITOR_ENTRY%')) throw new Error('src/index.html thiếu %EDITOR_ENTRY%');
writeFileSync(join(DIST, 'index.html'), html.replace('%EDITOR_ENTRY%', `./${editor.entry}`));
writeFileSync(
  join(DIST, 'bridge.js'),
  readFileSync(join(ROOT, 'src', 'bridge.js'), 'utf8').replace('%SOURCE_URL%', SOURCE_URL),
);
cpSync(join(ROOT, 'src', 'blockspace-logo.svg'), join(DIST, 'blockspace-logo.svg'));
cpSync(join(ROOT, 'LICENSE'), join(DIST, 'LICENSE.txt'));
console.log(
  `[studio] BlockSpace ${editor.version} (scratch-editor ${editor.tag}): ${files} file, ${(bytes / 1e6).toFixed(1)} MB → dist/ (${((Date.now() - started) / 1000).toFixed(1)}s)`,
);
