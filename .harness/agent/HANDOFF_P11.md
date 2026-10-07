# Handoff P11 — BlockSpace (Scratch Studio)

Thiết kế + quyết định: `docs/adr/003-scratch-studio.md`. Task board: `ACTIVE_TASKS.md §P11`.

## T11.5 Chia sẻ, gallery, remix, thích ✅ (2026-10-07)

- **API** (`scratch-sharing.service.ts`): `GET /scratch/classes` — lớp mình thuộc **hoặc tạo** (`/classes/mine`
  chỉ có membership nên GV tạo lớp không thấy lớp mình; luật này khớp `belongsToClass` của T11.3).
  `GET /scratch/gallery?scope=class&classId=` (không thuộc lớp ⇒ 403) | `scope=school` (school + public). Chỉ
  dự án ĐÃ có phiên bản, chưa xóa, tối đa 60, mới cập nhật trước. `POST …/:id/remix`: ai xem được đều remix
  được → bản sao **private** của mình, `remixOfId` = gốc, phiên bản 1 = bản mới nhất của gốc, chép tham chiếu
  asset mà phiên bản đó dùng (không chép file). `PUT|DELETE …/:id/like` idempotent.
- **Web:** `/studio` có tab **Của tôi · từng lớp · Cả trường** (ghi `?tab=` vào URL). Trang dự án: ♡ thích
  (cập nhật lạc quan, lỗi thì hoàn tác), **Remix** → mở trình soạn bản sao; chủ dự án có khung "Ai được xem dự
  án này?" (Chỉ mình tôi / Cả lớp + chọn lớp / Cả trường — đổi là lưu, server ghi audit; "Công khai" không có ở
  đây). Sửa lỗi tiềm ẩn: đi từ dự án này sang dự án khác (nhãn "Remix từ…") giờ dựng lại player (`key` theo id).
- **Đã kiểm** — API thật (`scratchpad/live-t115.mjs`, 25 ca): lớp của tôi đúng cho HV / GV tạo lớp / HV ngoài
  lớp; gallery lớp 403 với người ngoài, dự án "lớp" không lọt ra gallery trường; thích idempotent; remix: người
  ngoài 404, bản remix private (HV gốc 404), đúng nội dung, asset đọc được qua bản remix; chuyển "cả trường" ⇒
  người ngoài thấy + remix được. Bằng mắt: GV thấy dự án HV ở tab lớp → thích (tim đặc, 1) → Remix mở trình soạn
  "… (remix)" đủ nhân vật + khối; HV chủ đổi Chỉ mình tôi ↔ Cả lớp. Toàn API 380/380 test, web 20/20.

**Còn lại:** gallery chưa phân trang (60 dự án mới nhất), chưa tìm kiếm; chưa có ảnh thu nhỏ dự án (thẻ chỉ
có icon) — cần lưu thumbnail lúc lưu phiên bản. HV có thể thích dự án của chính mình.

## T11.4 FE dự án ✅ (2026-10-07)

- **Trang:** `/studio` "Dự án của tôi" (trong AppLayout; mục **BlockSpace** trên menu cho MỌI user — không
  phải khu vực theo vai trò), `/studio/:id/edit` trình soạn toàn màn hình (ngoài AppLayout), `/studio/:id`
  trang xem có player. Trang spike `StudioPage` đã bỏ.
- **Nạp/lưu không cần zip, trình soạn vẫn không có token:** bridge thêm `blockspace:open` (project.json +
  asset LMS tải bằng token, nạp sẵn vào `storage.builtinHelper` rồi `vm.loadProject`) và
  `blockspace:export` (`vm.toJSON()` + `vm.assets`). `features/studio/projectSync.ts`: khi mở tải
  `versions/latest` + asset riêng (404 = asset thư viện, để CDN lo); khi lưu tải asset MỚI lên trước rồi
  mới lưu phiên bản (upload lỗi ⇒ không lưu phiên bản trỏ asset thiếu).
- **Tự lưu** 20 giây sau thay đổi + khi ẩn tab + trước khi rời trang bằng nút trong app; cờ "chưa lưu"
  dùng bộ đếm thay đổi nên sửa tiếp TRONG lúc đang lưu vẫn còn "chưa lưu". Đổi tên dự án trong trình
  soạn ⇒ PATCH tên khi lưu. Mở .sb3 từ máy ⇒ lưu ngay thành phiên bản mới.
- **Lớp che "Đang mở dự án…"** tới khi dự án thật nạp xong — trước đó trình soạn đang hiện dự án mặc định,
  sửa vào sẽ mất (phát hiện khi xem bằng mắt). Màn hình < 1024 px: báo dùng máy tính/máy tính bảng ngang,
  có "Xem dự án" và "Vẫn mở trình soạn".
- **Player** cỡ cố định 482×406 (đo trong iframe: sân khấu 482×362 + thanh cờ 44) — khung to hơn chỉ thêm
  dải xám thừa.

**Đã xem bằng mắt (dev):** HV tạo dự án → kéo khối + thêm "Rex laptop" → "Có thay đổi chưa lưu" → Lưu (5
asset tải lên rồi mới lưu phiên bản) → tải lại trang: còn đủ 2 nhân vật + khối lệnh. Mở lại 6,2 s (gần hết
là trình soạn khởi động trên Vite dev; API ~50 ms). Trang xem: cờ xanh chạy. GV (dự án HV chia sẻ lớp):
vào link sửa ⇒ chuyển sang trang xem, không có "Mở trình soạn", player chạy với asset riêng của HV.
Cảnh báo màn hình hẹp ở 800 px. 5 test vitest cho `projectSync`; web 20/20 test, i18n 641/641.

**Còn lại:**
- Chưa có giao diện chia sẻ / gallery lớp (T11.5) — GV chỉ vào được dự án HV qua link.
- Lưu kèm cả asset mặc định (nền trắng, tiếng "pop", Rex) của mỗi dự án mới — dùng chung theo md5 nên chỉ
  lưu một lần trên toàn hệ thống, nhưng tính hạn mức cho người tải đầu tiên.
- Hai tab cùng sửa một dự án: phiên bản sau ghi đè (chưa có khóa) — làm chung thật sự ở T11.6.
- Dự án chưa lưu lần nào: GET `versions/latest` trả 404 (console trình duyệt có dòng đỏ, vô hại).

## T11.3 Backend dự án ✅ (2026-10-07)

Module `apps/api/src/scratch/`. Endpoint: `docs/DESIGN.md §8` (khối BlockSpace).

- **Quyền một chỗ** `ScratchAccessService`: chủ/đồng tác giả; `school`/`public` = mọi tài khoản;
  `class` = thành viên đang học **hoặc người tạo lớp** (GV thường không tự vào lớp — bài học P10);
  lớp đã xóa ⇒ như private. Không xem được ⇒ **404** (không lộ tồn tại); xem mà không sửa ⇒ 403.
  Lịch sử phiên bản chỉ cho người sửa; người xem chỉ đọc bản mới nhất / theo số.
- **Phiên bản:** `project.json` gửi **multipart** (multer giới hạn đúng 5 MB, khỏi nới giới hạn body
  JSON 100 KB của toàn API); kiểm cấu trúc tối thiểu + mọi `md5ext` theo allowlist. Số `seq` trong
  transaction, trùng (lưu đồng thời) ⇒ thử lại 3 lần rồi 409. Mỗi lần lưu gắn asset ĐÃ có trên server
  vào `scratch_project_assets` và dọn bản chưa đóng băng cũ hơn 20 bản gần nhất.
- **Asset:** tên = md5ext; server kiểm **md5 của nội dung khớp tên** (asset dùng chung — không kiểm thì
  ai đó "chiếm" md5ext bằng nội dung khác để tráo ảnh trong dự án bạn khác), magic bytes theo đuôi, mime
  lấy từ allowlist. Trùng nội dung ⇒ `created:false`, không tính hạn mức. Hạn mức **200 MB/người**.
  Phục vụ: chỉ qua dự án tham chiếu asset, header `CSP: sandbox` + `attachment` + `nosniff` (SVG có thể
  chứa script, cùng origin LMS).
- **Audit** cùng transaction: `scratch.project.share` (đổi phạm vi; chỉ id, không tên), `scratch.project.delete`.
- **Kiểm trên API thật** (3 tài khoản thử, `scratchpad/live-t113.mjs`): 34/34 ca — tạo/lưu/tải asset,
  private 404 với người ngoài và GV, tự đặt public 400, chia sẻ vào lớp không thuộc 403, GV tạo lớp xem
  được nhưng sửa/lưu/xem lịch sử 403, asset đúng byte + header, xóa mềm. DB: audit đủ, asset thư viện
  không bị gắn. Toàn API 369/369 test.

**Để lại cho task sau:**
- Asset tải lên mà không phiên bản nào dùng (bỏ dở) vẫn chiếm hạn mức + storage ⇒ cần job dọn rác
  (asset không có dòng `scratch_project_assets` sau N ngày). Dọn bản cũ cũng chưa xóa asset mồ côi.
- Biết md5ext của asset = gắn được nó vào dự án mình (md5 không đoán được; chỉ người đã XEM được dự án
  chứa nó mới biết — tương đương tự remix). Chấp nhận; xem lại khi làm remix T11.5.
- Trình soạn chưa nói chuyện với API — T11.4 (LMS dựng sb3 từ project.json + asset rồi gửi vào iframe,
  trình soạn vẫn không cần token).
- Rate limit chung 600 request/phút/IP; cả lớp sau một NAT dùng chung một IP — theo dõi khi autosave chạy.

## T11.2 Contracts + schema ✅ (2026-10-07)

Migration `20261007052430_p11_scratch_projects` (chỉ tạo bảng mới, không đụng bảng cũ). Mô hình: `docs/DESIGN.md §4.7b`.
Contracts: `packages/contracts/src/scratch.ts`.

**Quyết định thiết kế:** thêm bảng `scratch_project_assets` (không có trong kế hoạch) — API T11.3 cần
biết asset thuộc dự án nào để kiểm quyền phục vụ asset private; quét jsonb của mọi phiên bản thì quá
đắt. Asset FK **Restrict** (dọn rác chỉ xóa asset không còn ai dùng). `classId` thêm ngay (chia sẻ lớp
cần) để T11.5 khỏi migration nữa. Xóa mềm dự án (bài nộp trỏ phiên bản đóng băng). Chưa có cột cho
công khai/biệt danh — để T11.5b. Không CHECK `visibility=class ⇔ classId` ở DB vì xóa lớp (SET NULL)
sẽ bị chặn → service coi `class` + `classId` NULL là `private`.

**Đã kiểm trên DB dev (transaction ROLLBACK):** trùng `seq` / trùng thích bị chặn; xóa asset đang được
tham chiếu bị chặn; xóa lớp → `classId` NULL; xóa bản gốc → `remixOfId` NULL; xóa dự án → phiên bản,
tham chiếu asset, lượt thích đi theo, file asset ở lại. API typecheck sạch, 334/334 test pass.

**⚠️ Sự cố DB dev (07/10):** chạy `prisma migrate diff --shadow-database-url "$DATABASE_URL"` → Prisma
reset DB dev làm shadow. Mất toàn bộ dữ liệu dev (khóa học, lớp, `p7member`/`p7outsider`); không có
bản sao lưu. Đã dựng lại schema (13 migration, baseline bằng `migrate resolve`) + `seed.cjs` (quyền,
vai trò, 9 huy hiệu, admin `p9-admin@codespace.local`). Production không bị đụng. Kiểm drift: dùng
`--from-url "$DATABASE_URL"`, KHÔNG dùng shadow.

## T11.0 Build từ mã nguồn ✅ (2026-10-07) — release `blockspace-editor-15.2.0-bs1` đã ghim

**Làm gì:** `apps/studio/scripts/build-editor.mjs` clone `scratch-editor` **v15.2.0** (kiểm commit
`5fe8235`), áp 4 bản vá `apps/studio/editor/patches/`, sinh `rex-assets.js`, lọc thư viện, `npm ci
--ignore-scripts`, webpack 7 package → `.cache/blockspace-editor-15.2.0-bs1.tgz`. `build.mjs` (chạy
trong turbo/Docker) chỉ **lấy tarball** (cục bộ nếu có, không thì tải GitHub Releases + kiểm sha512).
Không cần fork riêng: repo LMS công khai, link "Mã nguồn" trỏ `apps/studio` (AGPL §13).

**Bản vá (sửa gốc thay vì vá ngoài như spike):** 0001 dự án mặc định Rex (Mèo + tiếng meo ra khỏi
bundle — đã grep: 0 lần), 0002 menu dùng prop `logo` (bỏ MutationObserver — bẫy 4), 0003
`ThrottledPropertyHOC` render bù (bỏ trễ 600 ms + watermark trống lần mở đầu — bẫy 6), 0004
publicPath `/studio/editor/` cho cả scratch-storage (thay regex vá 2 runtime — bẫy 1) + bundle có hash
`static/js/…` → Caddy cache vĩnh viễn, khỏi sửa Caddyfile. Bẫy 5 (tên dự án) không phải lỗi: là prop có
kiểm soát, bridge dùng đúng cách. Thư viện: −10 nhân vật thương hiệu Scratch (Mèo, Gobo, Pico, Nano,
Tera, Giga…) và 31 costume của chúng; +6 dáng Rex (nhân vật + costume), nạp sẵn trong bundle nên không
gọi máy chủ Scratch. `default-project.sb3` bỏ — LMS gửi `blockspace:new`, trình soạn dựng dự án Rex có sẵn.

**Số đo:** build từ đầu 12,8 phút trên máy dev (npm ci 3,5 phút, 2 944 package); 1 695 file, 101,6 MB
(≈ bản npm). Node 20 build được (upstream dùng 24; workflow dùng 24).

**Đã kiểm bằng mắt:** Rex mặc định, watermark hiện Rex ngay lần mở đầu, logo + alt BlockSpace, menu ⓘ
"Mã nguồn BlockSpace" / "Giấy phép (AGPL-3.0)", thư viện 6 Rex đầu danh sách, thêm "Rex laptop" →
0 request tới `scratch.mit.edu`, watermark đổi ngay. Trong `/studio`: new → tên "Dự án của Rex", lưu →
`.sb3` 54 KB chỉ có Rex + nền + pop, new/nạp lại đều đặt đúng tên.

**Còn lại:**
- ✅ Release `blockspace-editor-15.2.0-bs1` (76,7 MB, workflow tự build khi push) đã ghim sha512;
  kiểm bản CI: 0 asset Mèo, publicPath đúng, 1 695 file. Hash bundle khác bản build máy dev (Node 24
  vs 20) — bình thường, chỉ bản đã ghim mới lên production.
- Bản dịch vi của upstream: nút Debug hiện "Sửa lỗi .DANV" — sửa bằng bản vá chuỗi dịch hoặc ẩn nút.
- Thư viện "Hướng dẫn" (tutorials) vẫn là video/ảnh của Scratch (có Mèo) — cân nhắc ẩn ở T11.4.
- H6 rà pháp lý AGPL vẫn chặn phát hành.

## T11.1 Spike ✅ (2026-10-07)

**Chứng minh được:** trình soạn Scratch 3 (`@scratch/scratch-gui@15.2.0`, AGPL) chạy trong LMS
dưới tên BlockSpace, nhân vật mặc định Rex, giao diện tiếng Việt, nạp/lưu dự án qua `postMessage`.
Trang thử: `/studio` (toàn màn hình, ngoài `AppLayout`, chưa gắn menu, mọi user đăng nhập).

### Cách dựng (đọc `apps/studio/README.md`)

- Package mới `apps/studio` (`@lms/studio`, **AGPL-3.0-only**, có `LICENSE`).
- **Không** khai báo scratch-gui làm dependency pnpm (69 dep nặng: TensorFlow, MediaPipe…).
  `scripts/build.mjs` tải tarball đúng phiên bản, kiểm sha512, chỉ lấy `dist/` đã build sẵn.
  npm có sẵn `dist/scratch-gui-standalone.js` (gói kèm React, biến toàn cục `GUI`) → **không cần
  build Scratch từ mã nguồn** ở giai đoạn này.
- Web phục vụ `apps/studio/dist` tại `/studio/editor/` qua `vite-plugin-static-copy` (cùng cách
  Monaco/Pyodide). `@lms/web` có devDependency `@lms/studio` để turbo build studio trước.
- Dockerfile web, Caddyfile (cache immutable cho `static/` + `chunks/`), CI (cache tarball) đã cập nhật.

### Số đo

| Hạng mục | Giá trị |
|---|---|
| File tĩnh BlockSpace | 1.695 file, **102,5 MB** (dist web 47 → 149 MB) |
| Tarball tải lúc build | 150 MB (cache `apps/studio/.cache/`, CI cache theo hash script) |
| Lần mở đầu | 22 request, 17,3 MB giải nén; **~5,7 MB gzip** qua mạng (bundle chính 17 MB) |
| Thời gian tới "sẵn sàng" | 1,0–2,1 s trên máy dev (đã cache) — chưa đo mạng thật |
| Bộ nhớ trang | ~66 MB JS heap |
| Gọi máy ngoài lúc khởi động | **không** (thư viện nhân vật/âm thanh mới gọi `assets.scratch.mit.edu` khi mở) |
| RAM VPS | **0** — toàn bộ chạy ở trình duyệt |

### Đã kiểm bằng mắt / bằng VM thật

Rex hiện đúng, bấm cờ xanh Rex nói "Xin chào! Mình là Rex 👋"; đổi tên nhân vật → LMS báo "Có thay
đổi chưa lưu"; lưu → nhận `.sb3` 52 KB, trạng thái về "Đã lưu"; mở dự án mới rồi nạp lại bản đã lưu
→ tên đã đổi còn nguyên. Logo BlockSpace, tên dự án do LMS đặt, không còn thông báo lỗi.

### Bẫy đã gặp (bundle npm làm sẵn cho scratch.mit.edu)

1. **`publicPath="/"` hard-code ở HAI runtime webpack** (GUI + runtime lồng của scratch-storage nạp
   `chunks/fetch-worker`). Sót cái thứ hai → worker nhận `index.html` của LMS → `Unexpected token '<'`,
   dự án không nạp. Build vá cả hai và **dừng nếu số chỗ khác 2** (bundle đổi thì biết ngay).
2. **Không truyền `projectId`** → trình soạn không nạp gì, không bao giờ gọi `onProjectLoaded`.
   Truyền `'0'` (dự án mặc định dựng sẵn).
3. **`canCreateNew: true`** = "được tạo dự án trên server Scratch" → tự lưu lên scratch.mit.edu, báo
   "Không thể tạo dự án". Đặt `false`; LMS lo tạo/lưu.
4. **Prop `logo` bị thanh menu bỏ qua** → bridge canh `#logo_img` bằng MutationObserver.
5. **Tên dự án đi theo prop `projectTitle`** (TitledHOC ghi đè Redux) → render lại với prop mới.
6. **Watermark góc khung code** bọc `ThrottledPropertyHOC(500ms)`: nạp dự án LMS ngay sau dự án
   mặc định thì cập nhật bị nuốt vĩnh viễn → báo "sẵn sàng" trễ 600 ms. Còn sót: lần mở đầu góc đó
   **trống** tới khi bấm chọn nhân vật (không còn Mèo).
7. Windows: GNU tar của Git Bash hiểu `D:\` là máy chủ → tar chạy với đường dẫn tương đối + `cwd`;
   Vite dev giữ file trong `dist` → `rmSync` có retry (hoặc tắt web dev khi build lại studio).

### Còn lại — đưa vào T11.0 / các task sau

- **Mèo vẫn nằm trong bundle** (dự án mặc định `'0'`, nháy 0,6 s lúc mở; menu "Tập tin" vẫn có thể
  sinh ra). Bỏ hẳn cần **tự build scratch-gui từ mã nguồn** với dự án mặc định là Rex (fork T11.0)
  — khi đó cũng sửa luôn bẫy 4, 5, 6 ở mã nguồn thay vì vá ngoài.
- **Rex chưa có trong thư viện nhân vật** (`dynamicAssets` + tự host thumbnail) — T11.0.
- **Link "Mã nguồn" (AGPL §13)** chưa có trong giao diện — bắt buộc trước khi phát hành.
- Tích hợp lưu đúng nghĩa: cài `GUIConfig.storage.saveProject` chuyển lệnh "Lưu ngay" của menu qua
  postMessage về LMS → API T11.3 (hiện "Lưu" chỉ tải file về máy).
- **Màn hình hẹp**: dưới ~1024 px trình soạn không dùng được (đúng như Scratch gốc) → T11.4 cần thông
  báo "mở trên máy tính/máy tính bảng ngang" cho điện thoại.
- `scratch-gui-standalone.js` 17 MB không có hash → Caddy `no-cache` + ETag (304); nếu muốn cache
  vĩnh viễn thì build thêm hash vào tên ở T11.0.
- Ảnh Docker web to thêm ~100 MB; build tải 150 MB từ npm (registry sập = build lỗi).
