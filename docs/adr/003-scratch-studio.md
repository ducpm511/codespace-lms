# ADR 003: Scratch Studio — nền tảng sáng tạo Scratch thay thế scratch.mit.edu

Date: 2026-10-07
Status: **Accepted** (2026-10-07) — người dùng chốt Q1, Q3–Q6; còn Q2 (tên) và rà soát pháp lý AGPL.

## Context

Mục tiêu (người dùng, 2026-10-07): học viên **tạo dự án, lập trình Scratch, chia sẻ, làm chung một
dự án** ngay trong LMS — *thay thế hoàn toàn* scratch.mit.edu, không chỉ để nộp bài. Chấm bài: GV chấm
tay, LMS đọc file dự án để đưa **gợi ý tiêu chí** (không tự cho điểm).

Ràng buộc đã biết:

- **Học viên 7–16 tuổi.** Phần lớn dưới 13 → không thể bắt tạo tài khoản scratch.mit.edu, và mọi tính
  năng xã hội (chia sẻ, bình luận) phải giới hạn trong phạm vi trường/lớp, có GV kiểm soát.
- **VPS 2 GB RAM** (đo sau P10: ~555 MB dùng). Trình soạn phải là file tĩnh chạy ở trình duyệt; không
  được thêm tiến trình nặng phía server.
- **Lưu trữ**: đã có `STORAGE_DRIVER=cloudinary|local` + module `files` (allowlist mime + magic bytes).
- **Giấy phép trình soạn (kiểm 2026-10-07):**
  - `scratch-gui`/`scratch-vm` bản hiện hành (monorepo `scratchfoundation/scratch-editor`,
    gói `@scratch/scratch-gui`) là **AGPL-3.0** từ khoảng đầu 2025. Các bản cũ hơn vẫn **BSD-3-Clause**
    (giấy phép không rút lại được).
  - TurboWarp (fork phổ biến, nhanh hơn nhờ compiler) là **GPL-3.0**.
- **Thương hiệu**: file `TRADEMARK` của Scratch cấm dùng tên Scratch, logo, Mèo Scratch, Gobo, Pico,
  Nano, Tera, Giga để quảng bá sản phẩm phái sinh nếu không có văn bản cho phép của MIT
  → bản của mình phải **đổi tên + đổi nhân vật mặc định**.

## Quyết định của người dùng (2026-10-07)

| Câu | Chốt | Hệ quả bắt buộc |
|---|---|---|
| Q1 | **scratch-gui mới nhất (AGPL-3.0)**, monorepo `scratch-editor` | Fork công khai + link "Mã nguồn" trong trình soạn (AGPL §13) |
| Q3 | **Có cả công khai** (ai có link cũng xem được) | Xem D4′ — duyệt trước khi công khai, ẩn danh tính |
| Q4 | **Bật bình luận** | Xem D8 — kiểm duyệt, báo cáo, không bình luận ở chế độ công khai |
| Q5 | **Bật ghi âm micro + tải ảnh/âm thanh** | D7 càng quan trọng: asset private, chỉ lộ theo visibility |
| Q6 | **Làm chung thời gian thực ngay** | D5 thay bằng D5′ — WebSocket ở P11 |

## Decision

**D1. Trình soạn = bản build tĩnh của scratch-gui, tự host, nhúng bằng `<iframe>` cùng origin
(`/studio/editor/`).** LMS và trình soạn nói chuyện qua `postMessage` (nạp dự án, lưu, báo thay đổi).
Tách iframe để: (a) bundle React/Redux riêng của scratch-gui không lẫn vào app LMS; (b) ranh giới
chương trình rõ ràng cho nghĩa vụ giấy phép; (c) tải lười — trang LMS khác không phải trả giá.
Nhánh mã nguồn trình soạn đã sửa để trong repo riêng công khai (nghĩa vụ AGPL/GPL: cung cấp mã nguồn
cho người dùng qua mạng) — **cần người chọn bản gốc, xem Q1**.

**D2. Đổi thương hiệu**: tên sản phẩm (đề xuất *CodeSpace Studio*), logo, nhân vật mặc định = mascot
CodeSpace. Bỏ link về scratch.mit.edu trong menu. Thư viện nhân vật/âm thanh mặc định tạm lấy từ CDN
`assets.scratch.mit.edu` như bản gốc; tự host thư viện là việc sau (cần kiểm giấy phép từng asset).

**D3. Lưu trữ dự án theo kiểu Scratch: tách `project.json` và asset.**
- Asset (ảnh/âm thanh) lưu **theo nội dung** (`md5ext`, đúng cách Scratch đặt tên) → dự án remix
  hay nhiều phiên bản dùng chung asset, không nhân bản file.
- `project.json` lưu trong Postgres theo **phiên bản** (autosave tạo phiên bản mới, giữ N bản gần
  nhất + mọi bản đã nộp bài/chia sẻ). Nộp bài = **đóng băng** một phiên bản, sửa tiếp không đổi bài nộp.
- Giới hạn: `project.json` ≤ 5 MB, mỗi asset ≤ 10 MB, tổng mỗi học viên có hạn mức (con số chốt ở T11.3).

**D4′. Chia sẻ** — `visibility`: `private` → `class` → `school` (tài khoản CodeSpace) → `public`
(ai có link). Vì học viên phần lớn dưới 13 tuổi, `public` có rào chắn **mặc định** (đổi được bằng ADR mới):
- Học viên **xin** công khai → GV của lớp hoặc admin **duyệt** mới lên `public`; sửa dự án đã công khai
  thì bản công khai giữ nguyên tới khi duyệt lại (công khai = một phiên bản đóng băng).
- Trang công khai **không hiện họ tên** — chỉ biệt danh do em tự đặt (GV duyệt), không hiện lớp/trường.
- Trang công khai chỉ có player + remix-về-tài-khoản-của-mình (phải đăng nhập); **không bình luận**.
- Nút **Báo cáo** trên mọi trang dự án; GV/admin gỡ công khai được ngay, có audit. Trang dự án có trình chiếu (player),
nút **Remix** (sao chép, giữ dòng dõi "remix từ…"), **thích**. Gallery theo lớp (tương đương
"studio" của Scratch).

**D5′. Làm chung thời gian thực (P11).** Đồng tác giả được chủ dự án mời (cùng trường).
- Server **giữ thứ tự** (authoritative sequencing): mỗi client bắt sự kiện thay đổi của VM/Blockly
  (tạo/xóa/di chuyển khối, đổi trường, thêm/xóa nhân vật, đổi costume/âm thanh, đổi tên) → gửi op qua
  WebSocket → server gán số thứ tự, phát lại cho cả phòng → mọi client áp op theo đúng thứ tự.
  Hướng tham khảo: Blocklive (mã nguồn mở, đồng bộ dự án Scratch qua websocket) — **kiểm giấy phép
  trước khi chép mã**, mặc định chỉ học ý tưởng.
- Xung đột: khối/sprite bị người khác xóa → op sau bị bỏ, client nạp lại trạng thái; **trình vẽ**
  (paint editor) không đồng bộ từng nét — đồng bộ khi costume được lưu, người sau ghi đè (báo cho người kia).
- Server ghi **snapshot** `project.json` định kỳ (vd 30 giây hoặc mỗi 200 op) + khi phòng trống → nạp
  lại không mất quá 30 giây công việc. Asset tải lên qua HTTP như D3, op chỉ mang `md5ext`.
- Hạ tầng: gateway WebSocket trong NestJS (`@nestjs/websockets` + `ws`), Caddy proxy `/api/studio/ws`.
  Phòng giữ trong RAM tiến trình API, giới hạn ≤ 6 người/phòng; **đo RAM** ở spike T11.6a trước khi
  làm tiếp. Một tiến trình API → không cần Redis pub/sub ở giai đoạn này.
- Fallback: mất kết nối → chế độ chỉ đọc + tự nối lại; không cho sửa offline rồi gộp.

**D6. Gắn vào LMS:** (a) loại hoạt động bài học `scratch` (mở trình soạn với dự án mẫu của GV, mỗi em
một bản sao riêng); (b) hình thức nộp `scratch` cho Bài tập — nộp một phiên bản đã đóng băng; (c) màn
hình chấm: player + bảng **gợi ý tiêu chí** do GV đặt (đọc `project.json` tĩnh: có khối sự kiện "khi
bấm cờ xanh"? dùng vòng lặp? ≥ N nhân vật? có biến?) — chỉ gợi ý, GV vẫn cho điểm. XP: hoàn thành
hoạt động Scratch tính như hoàn thành bài học; không thêm nguồn XP mới.

**D7. An toàn trẻ em & PII.** Trình soạn cho phép **ghi âm micro** và **tải ảnh lên** → có thể chứa
giọng nói/khuôn mặt học viên. Asset lưu **private storage**, phục vụ qua API có kiểm quyền theo
`visibility` (INVARIANT #3, #5). Bình luận (nếu bật) chỉ trong lớp, GV ẩn/xóa được, có audit.

**D8. Bình luận.** Chỉ ở `class`/`school`; mặc định GV của lớp thấy mọi bình luận trong lớp, ẩn/xóa
được (xóa mềm + audit); học viên báo cáo được; giới hạn tần suất; lọc từ ngữ cơ bản (danh sách do
trường quản lý). Không bình luận trên trang `public`.

## Consequences

- LMS có thêm một "app con" tĩnh khá nặng (ước lượng vài chục MB, phải đo ở spike T11.1); Caddy phục
  vụ, không tốn RAM server. Ảnh web Docker to ra tương ứng.
- Gánh nghĩa vụ giấy phép copyleft cho phần trình soạn (công khai mã nguồn bản đã sửa).
- Phụ thuộc CDN của MIT cho thư viện asset cho tới khi tự host.
- Dung lượng lưu trữ tăng theo số dự án; cần hạn mức + dọn phiên bản cũ.

## Open Questions (còn mở)

- **Q2. Tên sản phẩm** — tạm dùng *CodeSpace Studio* cho tới khi chốt.
- **Pháp lý:** nhờ người có chuyên môn xác nhận ranh giới AGPL giữa trình soạn (iframe) và LMS.
- **Người duyệt công khai** mặc định là GV của lớp — cần xác nhận quy trình nếu em học nhiều lớp.

## Open Questions ban đầu (đã chốt, giữ để tra lại)

- **Q1. Bản gốc trình soạn:** (a) scratch-gui mới nhất — AGPL-3.0, chính chủ, cập nhật lâu dài;
  (b) TurboWarp — GPL-3.0, chạy nhanh hơn, nhiều tính năng; (c) scratch-gui bản BSD cuối cùng — không
  copyleft nhưng đóng băng, không nhận bản vá mới. Cả (a)(b) đều buộc công khai mã nguồn phần trình soạn.
  Nên hỏi ý kiến pháp lý về ranh giới iframe/postMessage với AGPL.
- **Q2. Tên sản phẩm** thay cho "Scratch" (đề xuất *CodeSpace Studio*).
- **Q3. Phạm vi chia sẻ cao nhất:** chỉ lớp / toàn trường / có cả công khai internet.
- **Q4. Bình luận** trên dự án: bật (trong lớp, GV kiểm duyệt) hay tắt ở giai đoạn đầu.
- **Q5. Ghi âm micro + tải ảnh lên** trong trình soạn: cho phép hay tắt với học viên.
- **Q6.** Đồng ý làm chung **theo lượt trước**, thời gian thực để phase sau?
