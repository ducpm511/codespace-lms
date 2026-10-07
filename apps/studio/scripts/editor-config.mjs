// Cấu hình chung cho build-editor.mjs (build từ mã nguồn) và build.mjs (đóng gói vào LMS).
// SPDX-License-Identifier: AGPL-3.0-only

/** Bản gốc trình soạn. Nâng bản = đổi cả 3 trường + kiểm lại editor/patches/. */
export const EDITOR = {
  repo: 'https://github.com/scratchfoundation/scratch-editor.git',
  tag: 'v15.2.0',
  commit: '5fe823510f3ae0cc7291d49bc824cc5c54fe7723',
  // Tăng hậu tố `-bsN` mỗi khi đổi bản vá / asset Rex → tên tarball mới, không lẫn cache cũ.
  version: '15.2.0-bs1',
};

/**
 * Bản build sẵn trên GitHub Releases của repo LMS (workflow `blockspace-editor.yml` tạo ra).
 * `integrity: null` = chưa phát hành bản này → build.mjs đòi tarball cục bộ từ build:editor.
 */
export const RELEASE = {
  url: `https://github.com/ducpm511/codespace-lms/releases/download/blockspace-editor-${EDITOR.version}/blockspace-editor-${EDITOR.version}.tgz`,
  integrity: null,
};

/** Mã nguồn tương ứng (AGPL §13) — link "Mã nguồn" trong trình soạn trỏ về đây. */
export const SOURCE_URL = 'https://github.com/ducpm511/codespace-lms/tree/main/apps/studio';

/** Nơi apps/web phục vụ trình soạn (vite-plugin-static-copy + Caddy). */
export const PUBLIC_PATH = '/studio/editor/';

/** 6 dáng Rex (apps/studio/assets/rex, cao 200 px) — thư viện nhân vật + thư viện costume. */
export const REX_POSES = [
  { file: 'rex-default.png', name: 'Rex vui' },
  { file: 'rex-huh.png', name: 'Rex chạy' },
  { file: 'rex-laptop.png', name: 'Rex laptop' },
  { file: 'rex-hearts.png', name: 'Rex cổ vũ' },
  { file: 'rex-love.png', name: 'Rex trái tim' },
  { file: 'rex-grumpy.png', name: 'Rex cau có' },
];

/** Costume của nhân vật Rex trong dự án mới ("Rex 1", "Rex 2" — ADR 003 D2). */
export const DEFAULT_REX_POSES = ['rex-default.png', 'rex-huh.png'];

/** Nhân vật thương hiệu Scratch (file TRADEMARK của scratch-editor) — gỡ khỏi thư viện. */
export const TRADEMARKED_SPRITES = [
  'Cat',
  'Cat 2',
  'Cat Flying',
  'Gobo',
  'Pico',
  'Pico Walking',
  'Nano',
  'Tera',
  'Giga',
  'Giga Walking',
];
