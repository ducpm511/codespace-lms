# wf-refactor

<!-- WORKFLOW: Refactor / Tech Debt -->
<!-- AGENTS: Codex / Claude -->
<!-- MAX: 120 lines. -->

Cho task `refactor / extract / restructure` — cải thiện cấu trúc, **không đổi hành vi**.

## Steps
1. Xác định phạm vi refactor. Đảm bảo có test bao phủ hành vi hiện tại (thiếu thì viết trước).
2. Refactor trong một surface/module. Không mở rộng sang module khác.
3. Giữ nguyên hành vi quan sát được (API shape, response). Đổi shape → là task feature, không phải refactor.
4. Không phá invariant: soft-ref, ownership, idempotency, audit vẫn nguyên.
5. `pnpm validate` — test cũ vẫn xanh (bằng chứng hành vi không đổi).
6. Handoff.

## Never
- Trộn refactor với thêm tính năng trong một task.
- Đổi hợp đồng API dưới danh nghĩa "refactor".
- "Tiện tay" dọn code ngoài scope.
