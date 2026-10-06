# BlockSpace (`@lms/studio`)

Trình soạn Scratch 3 tự host cho CodeSpace LMS — xem `docs/adr/003-scratch-studio.md`.

> **Giấy phép: AGPL-3.0-only** (file `LICENSE`). Package này đóng gói và sửa `@scratch/scratch-gui`
> (AGPL-3.0) nên mọi thay đổi ở đây phải công khai mã nguồn cho người dùng (AGPL §13). Phần còn lại
> của LMS là chương trình riêng, chỉ nói chuyện với trình soạn qua `postMessage` (xem `src/bridge.js`).
> Ranh giới này đang chờ rà soát pháp lý (H6).

## Cách hoạt động

- `scripts/build.mjs` tải **đúng** `@scratch/scratch-gui@15.2.0` từ npm (kiểm sha512), chỉ lấy
  `dist/` đã build sẵn — **không** khai báo làm dependency pnpm vì gói kéo theo 69 dependency nặng
  (TensorFlow, MediaPipe…) mà ta không cần. Tarball ~150 MB, cache ở `.cache/`.
- Bundle hard-code `publicPath="/"` → build vá thành `/studio/editor/` (sửa đổi có ghi nhận).
- `src/index.html` + `src/bridge.js`: dựng trình soạn bằng `GUI.createStandaloneRoot`, đổi logo,
  ngôn ngữ `vi`, và nói chuyện với trang cha:

| Hướng | `type` | Dữ liệu |
|---|---|---|
| editor → cha | `blockspace:ready` | — |
| cha → editor | `blockspace:load` | `sb3: ArrayBuffer` |
| editor → cha | `blockspace:loaded` / `blockspace:error` | `message?` |
| editor → cha | `blockspace:changed` | — (dự án vừa đổi, chưa lưu) |
| cha → editor | `blockspace:save` | `requestId` |
| editor → cha | `blockspace:saved` | `requestId`, `sb3: ArrayBuffer`, `title` |

  Hai phía đều bỏ qua message khác origin. Trình soạn **không** gọi API LMS, không cần token —
  nên sau này tách sang origin riêng (an toàn hơn) chỉ là đổi URL iframe.
- `default-project.sb3` được sinh lúc build: nhân vật **Rex** (mascot CodeSpace, ảnh trong
  `assets/rex/`, đã thu nhỏ còn cao 200 px) với 2 costume và một đoạn script chào.

## Lệnh

```bash
pnpm --filter @lms/studio build
```

Kết quả ở `dist/`; `apps/web` (vite-plugin-static-copy) phục vụ nó tại `/studio/editor/`.
