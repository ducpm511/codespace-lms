# wf-phase-planning

<!-- WORKFLOW: Phase Planning / Decomposition -->
<!-- AGENTS: Gemini (ưu tiên) -->
<!-- MAX: 120 lines. -->

Cho task phân rã một phase mới thành task breakdown. **Docs-only.**

## Steps
1. Đọc `docs/DESIGN.md §12 (MVP phases)` + `docs/DESIGN.md` + `CURRENT_STATE.md`.
2. Chia phase thành các task **một-surface**, mỗi task có: scope, surface, risk, order (dependency).
3. Đánh dấu blocker/prerequisite (vd phụ thuộc/câu hỏi cần bên ngoài xác nhận).
4. Ghi vào `.harness/agent/ACTIVE_TASKS.md` theo format bảng hiện có (giữ ≤200 dòng).
5. Kèm Acceptance Criteria đo được cho phase.

## Nguyên tắc chia task
- Contracts trước, rồi schema, backend, frontend.
- Tách high-risk (auth/IDOR/AI) thành task riêng, gắn cờ rõ.
- FE có thể bắt đầu ngay khi contracts xong (song song backend).
- **Mỗi task phải vừa ≤ 40% context của một session** (`cx-token-budget`). Task cần đọc > ~10–15 file
  hoặc trải nhiều module = quá to → chia nhỏ tiếp. Đây là mục tiêu chính khi chia task.

## Never
- Implement code.
- Tạo task gộp nhiều surface (dùng `wf-composite-task.md` khi thực thi).
