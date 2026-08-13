# cx-hard-limits

<!-- CONSTRAINTS: Hard Limits -->
<!-- SCOPE: All agents. All tasks. No exceptions. -->
<!-- MAX: 80 lines. Split by concern if approaching. -->

Cấm tuyệt đối. Nếu task buộc vi phạm bất kỳ điều nào → **dừng và escalate cho con người**.
Không suy diễn ngoại lệ, không tự cho là có context override.

---

## SECURITY — Never Violate

```
NEVER commit secret/token/password/connection string. Giữ .env.example toàn giá trị giả.
NEVER lộ token/JWT ra frontend. Session nhạy cảm nằm server-side.
NEVER bỏ ownership check trên route :id — kiểm quyền ở service/guard, không tin URL.
NEVER đưa PII vào URL query hoặc log không che.
NEVER expose stack trace / lỗi nội bộ ra HTTP client (production trả message chung).
NEVER tin input client (role/ownership/giá trị) mà không validate ở biên.
```

## DATA INTEGRITY — Never Violate

```
NEVER ghi đè dữ liệu quan trọng im lặng — ghi audit trong CÙNG transaction với ghi domain.
NEVER dùng Float cho giá trị cần chính xác (tiền/điểm...) — dùng Decimal.
NEVER ghi bản ghi trùng khi thao tác nên idempotent — dùng upsert trên unique key.
```

## MONOREPO BOUNDARIES — Never Violate

```
NEVER viết logic backend trong app frontend; NEVER viết render UI trong app backend.
NEVER import chéo giữa các app.
NEVER đặt business logic trong package type/contracts (chỉ type/DTO).
```

## CONTEXT / SCOPE — Never Violate

```
NEVER quét cả repo để hiểu một task. Bắt đầu hẹp, chỉ đọc file liên quan.
NEVER dọn code ngoài scope trong một task scoped (tách task refactor riêng).
NEVER vượt 40% context — checkpoint và handoff (.harness/constraints/cx-token-budget.md).
NEVER dựa vào lịch sử chat làm nguồn sự thật — memory sống trong .harness/agent/ + docs/.
NEVER sửa ADR cũ (tạo ADR mới, ghi "Supersedes ADR NNN").
```

---

## DOMAIN — CodeSpace LMS

> Nguồn: `docs/DESIGN.md §5.5` + `.harness/agent/CURRENT_STATE.md`. Nguồn sự thật dữ liệu = PostgreSQL.

```
NEVER chạy code học viên trong tiến trình API — luôn qua runner CÁCH LY
      (no-network, FS read-only, giới hạn CPU/RAM/wall-time, cap kích thước stdout).
NEVER gửi TestCase.kind=hidden hoặc QuestionOption.isCorrect ra client khi đang làm bài.
NEVER cho học viên truy cập Lesson khi lớp chưa có LessonGate isActive=true.
NEVER hard-delete Certificate/Submission/GradeEntry — chỉ soft-delete/revoke (giữ lịch sử).
NEVER tin điểm/kết quả client gửi lên (Pyodide) — luôn chấm lại ở server; điểm là Decimal.
NEVER lộ storageKey/URL nội bộ file private ra client — chỉ trả signed URL ngắn hạn (StorageAdapter).
```
