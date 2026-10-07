# BlockSpace (`@lms/studio`)

Trình soạn Scratch 3 tự host cho CodeSpace LMS — xem `docs/adr/003-scratch-studio.md`.

> **Giấy phép: AGPL-3.0-only** (file `LICENSE`). Package này build và sửa `scratch-editor`
> (AGPL-3.0) nên mọi thay đổi ở đây phải công khai mã nguồn cho người dùng (AGPL §13) — trình soạn có
> menu ⓘ › "Mã nguồn BlockSpace" trỏ về thư mục này. Phần còn lại của LMS là chương trình riêng, chỉ
> nói chuyện với trình soạn qua `postMessage` (xem `src/bridge.js`). Ranh giới này đang chờ rà soát
> pháp lý (H6).

## Mã nguồn tương ứng

Trình soạn = `scratchfoundation/scratch-editor` **đúng tag/commit ghi trong `scripts/editor-config.mjs`**
\+ các bản vá trong `editor/patches/` + ảnh Rex trong `assets/rex/`. `scripts/build-editor.mjs` dựng lại
được bản chạy trên production từ đúng ba thứ đó:

| Bản vá | Nội dung |
|---|---|
| `0001-default-project-rex` | Dự án mới có nhân vật **Rex** (2 costume) thay Mèo Scratch; Mèo + tiếng meo không còn trong bundle. 6 dáng Rex nạp sẵn trong bundle cho thư viện (không gọi máy chủ Scratch). |
| `0002-menu-bar-logo-prop` | Thanh menu dùng prop `logo`/`logoAlt` (bản gốc bỏ qua prop, luôn hiện logo Scratch). |
| `0003-throttled-property-trailing-update` | `ThrottledPropertyHOC` render bù giá trị cuối khi hết khoảng chặn — bản gốc nuốt mất cập nhật đến trong 500 ms (watermark/ô nhân vật kẹt ảnh dự án trước). |
| `0004-webpack-public-path` | Khi có `BLOCKSPACE_PUBLIC_PATH`: phục vụ dưới `/studio/editor/`, bundle có hash trong tên (`static/js/…`) để cache vĩnh viễn. |

Ngoài bản vá, bước build còn **sinh** `src/lib/blockspace/rex-assets.js` (md5 + kích thước 6 ảnh Rex)
và **sửa dữ liệu thư viện**: gỡ nhân vật thương hiệu Scratch (Mèo, Gobo, Pico, Nano, Tera, Giga — file
`TRADEMARK`) cùng costume của chúng, thêm 6 dáng Rex vào thư viện nhân vật + costume. Thư viện còn lại
vẫn tải từ CDN `assets.scratch.mit.edu` như bản gốc (ADR 003 D2).

## Hai bước build

1. **`pnpm --filter @lms/studio build:editor`** — build trình soạn từ mã nguồn → `.cache/blockspace-editor-<ver>.tgz`.
   Lần đầu ~10–20 phút, cần mạng + ~3 GB đĩa (checkout ở `.cache/scratch-editor`, hoặc đặt
   `BLOCKSPACE_EDITOR_SRC` trỏ tới checkout có sẵn). `npm ci --ignore-scripts`: gói `canvas` (native,
   chỉ dùng cho test) không build được trên Windows và không cần cho bundle.
   Bản dùng cho production do workflow **"BlockSpace editor"** (chạy tay trên GitHub Actions) build và
   đăng lên GitHub Releases; ghim sha512 nó in ra vào `RELEASE.integrity`.
2. **`pnpm --filter @lms/studio build`** (turbo tự gọi trước `@lms/web`) — lấy tarball (cục bộ nếu có,
   không thì tải bản phát hành + kiểm sha512), giải nén vào `dist/`, chép `bridge.js`, `index.html`
   (gắn tên bundle có hash), logo, `LICENSE.txt`. `apps/web` phục vụ `dist/` tại `/studio/editor/`.

Đổi bản vá / ảnh Rex / nâng scratch-editor ⇒ **tăng `EDITOR.version`** (`-bsN`), chạy lại workflow, ghim
sha512 mới. Bản đã phát hành không bao giờ bị thay ruột.

## Giao thức postMessage

`src/index.html` + `src/bridge.js` dựng trình soạn bằng `GUI.createStandaloneRoot`, ngôn ngữ `vi`, và
nói chuyện với trang cha:

| Hướng | `type` | Dữ liệu |
|---|---|---|
| editor → cha | `blockspace:ready` | — |
| cha → editor | `blockspace:new` | `title?` — dự án mới (Rex) dựng sẵn trong bundle |
| cha → editor | `blockspace:open` | `projectJson: string`, `assets: {md5ext, data}[]`, `title?` — dự án từ server; asset nạp sẵn vào bộ nhớ scratch-storage, asset thư viện vẫn lấy từ CDN |
| cha → editor | `blockspace:load` | `sb3: ArrayBuffer`, `title?` — file .sb3 từ máy |
| editor → cha | `blockspace:loaded` / `blockspace:error` | `message?` |
| editor → cha | `blockspace:changed` | — (dự án vừa đổi, chưa lưu) |
| cha → editor | `blockspace:save` | `requestId` |
| editor → cha | `blockspace:saved` | `requestId`, `sb3: ArrayBuffer`, `title` |
| cha → editor | `blockspace:export` | `requestId` |
| editor → cha | `blockspace:exported` | `requestId`, `projectJson`, `assets: {md5ext, data}[]` (mọi asset đang dùng), `title` |

`index.html?mode=player` = chỉ sân khấu + cờ xanh (trang xem dự án), cỡ cố định 482×406.

Hai phía đều bỏ qua message khác origin. Trình soạn **không** gọi API LMS, không cần token — nên sau
này tách sang origin riêng (an toàn hơn) chỉ là đổi URL iframe.
