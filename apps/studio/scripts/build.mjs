// Build BlockSpace → apps/studio/dist (phục vụ tại /studio/editor/ bởi apps/web).
// SPDX-License-Identifier: AGPL-3.0-only
//
// 1. Tải @scratch/scratch-gui đúng phiên bản + kiểm sha512 (không dùng pnpm dependency — xem README).
// 2. Giải nén, chỉ lấy file runtime của dist/ (bỏ .map, bỏ bản non-standalone, bỏ types).
// 3. Vá publicPath "/" → "/studio/editor/".
// 4. Chép src/ và sinh default-project.sb3 có nhân vật Rex.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const DIST = join(ROOT, 'dist');

const SCRATCH_GUI = {
  version: '15.2.0',
  integrity: 'sha512-ZjKknkK6Suh0qtfCgaKNUt2Ilz/j6pWdTn6+Brrb2NLn8iXviccLfiSezAFvXqFqWaOMjac0sMfe8JpKkkOPTg==',
};
const PUBLIC_PATH = '/studio/editor/';

async function fetchTarball() {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `scratch-gui-${SCRATCH_GUI.version}.tgz`);
  if (!existsSync(file)) {
    const url = `https://registry.npmjs.org/@scratch/scratch-gui/-/scratch-gui-${SCRATCH_GUI.version}.tgz`;
    console.log(`[studio] tải ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tải scratch-gui lỗi HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const digest = 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64');
  if (digest !== SCRATCH_GUI.integrity) {
    rmSync(file);
    throw new Error(`scratch-gui sai mã băm (${digest}) — đã xóa cache, chạy lại để tải mới`);
  }
  return file;
}

function extractDist(tarball) {
  const outName = `scratch-gui-${SCRATCH_GUI.version}`;
  const out = join(CACHE, outName);
  if (!existsSync(join(out, 'package', 'dist', 'scratch-gui-standalone.js'))) {
    mkdirSync(out, { recursive: true });
    // `tar` có sẵn trên Linux/macOS và Windows 10+ (bsdtar). Đường dẫn TƯƠNG ĐỐI + cwd: GNU tar
    // (Git Bash) hiểu "D:\..." là "máy chủ D".
    execFileSync('tar', ['-xzf', basename(tarball), '-C', outName, 'package/dist'], {
      cwd: CACHE,
      stdio: 'inherit',
    });
  }
  return join(out, 'package', 'dist');
}

/** Chỉ file cần lúc chạy. */
function keep(rel) {
  if (rel.endsWith('.map')) return false;
  if (rel === 'scratch-gui.js' || rel.startsWith('scratch-gui.js.')) return false; // bản cần React ngoài
  if (rel.startsWith('types/') || rel.startsWith('types\\')) return false;
  return true;
}

function copyRuntime(srcDist) {
  let bytes = 0;
  let files = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = relative(srcDist, abs).replaceAll('\\', '/');
      if (statSync(abs).isDirectory()) walk(abs);
      else if (keep(rel)) {
        const dest = join(DIST, rel);
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(abs, dest);
        bytes += statSync(abs).size;
        files += 1;
      }
    }
  };
  walk(srcDist);
  return { bytes, files };
}

function patchPublicPath() {
  const file = join(DIST, 'scratch-gui-standalone.js');
  const src = readFileSync(file, 'utf8');
  // Hai runtime webpack: của GUI (`__webpack_require__`) và một runtime lồng của scratch-storage
  // (`__nested_webpack_require_<n>__`, nạp chunks/fetch-worker). Sót cái thứ hai → worker tải asset
  // trỏ về /chunks/ gốc domain, nhận index.html của LMS và dự án không nạp được.
  const re = /(__(?:nested_)?webpack_require(?:_\d+)?__)\.p="\/"/g;
  const count = (src.match(re) ?? []).length;
  if (count !== 2) throw new Error(`Không vá được publicPath: tìm thấy ${count} chỗ (cần đúng 2) — bundle đổi?`);
  writeFileSync(
    file,
    src.replace(re, (_m, req) => `${req}.p=${JSON.stringify(PUBLIC_PATH)}`),
  );
}

// --- default-project.sb3 (zip STORE, không cần thư viện) ---

function zipStore(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // STORE
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function asset(data, ext) {
  const md5 = createHash('md5').update(data).digest('hex');
  return { md5, md5ext: `${md5}.${ext}`, data };
}

function buildDefaultProject() {
  const backdrop = asset(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#ffffff"/></svg>',
    ),
    'svg',
  );
  const rexCostume = (file, name) => {
    const a = asset(readFileSync(join(ROOT, 'assets', 'rex', file)), 'png');
    const { w, h } = pngSize(a.data);
    return {
      a,
      json: {
        name,
        bitmapResolution: 2,
        dataFormat: 'png',
        assetId: a.md5,
        md5ext: a.md5ext,
        rotationCenterX: Math.round(w / 2),
        rotationCenterY: Math.round(h / 2),
      },
    };
  };
  const rex1 = rexCostume('rex-default.png', 'Rex 1');
  const rex2 = rexCostume('rex-huh.png', 'Rex 2');

  const project = {
    targets: [
      {
        isStage: true,
        name: 'Stage',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [
          {
            name: 'nền trắng',
            dataFormat: 'svg',
            assetId: backdrop.md5,
            md5ext: backdrop.md5ext,
            rotationCenterX: 240,
            rotationCenterY: 180,
          },
        ],
        sounds: [],
        volume: 100,
        layerOrder: 0,
        tempo: 60,
        videoTransparency: 50,
        videoState: 'on',
        textToSpeechLanguage: null,
      },
      {
        isStage: false,
        name: 'Rex',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {
          flag: {
            opcode: 'event_whenflagclicked',
            next: 'say',
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 40,
            y: 40,
          },
          say: {
            opcode: 'looks_sayforsecs',
            next: null,
            parent: 'flag',
            inputs: { MESSAGE: [1, [10, 'Xin chào! Mình là Rex 👋']], SECS: [1, [4, '2']] },
            fields: {},
            shadow: false,
            topLevel: false,
          },
        },
        comments: {},
        currentCostume: 0,
        costumes: [rex1.json, rex2.json],
        sounds: [],
        volume: 100,
        layerOrder: 1,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: 'all around',
      },
    ],
    monitors: [],
    extensions: [],
    meta: { semver: '3.0.0', vm: '0.2.0', agent: 'BlockSpace' },
  };

  const entries = [{ name: 'project.json', data: Buffer.from(JSON.stringify(project)) }];
  for (const a of [backdrop, rex1.a, rex2.a]) {
    if (!entries.some((e) => e.name === a.md5ext)) entries.push({ name: a.md5ext, data: a.data });
  }
  writeFileSync(join(DIST, 'default-project.sb3'), zipStore(entries));
}

const started = Date.now();
const tarball = await fetchTarball();
const srcDist = extractDist(tarball);
rmSync(DIST, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); // Windows: dev server có thể đang giữ file
mkdirSync(DIST, { recursive: true });
const { bytes, files } = copyRuntime(srcDist);
patchPublicPath();
for (const f of ['index.html', 'bridge.js', 'blockspace-logo.svg']) cpSync(join(ROOT, 'src', f), join(DIST, f));
cpSync(join(ROOT, 'LICENSE'), join(DIST, 'LICENSE.txt'));
buildDefaultProject();
console.log(
  `[studio] scratch-gui ${SCRATCH_GUI.version}: ${files} file, ${(bytes / 1e6).toFixed(1)} MB → dist/ (${((Date.now() - started) / 1000).toFixed(1)}s)`,
);
