# wf-memory-update

<!-- WORKFLOW: Memory / State Update (docs-only) -->
<!-- AGENTS: Any -->
<!-- MAX: 120 lines. -->

Cho task cập nhật trí nhớ dự án. **Docs-only — KHÔNG đổi code.**

## Steps
1. Xác định thay đổi cần ghi (task xong, pattern mới, quyết định mới).
2. Cập nhật đúng file:
   - `.harness/agent/ACTIVE_TASKS.md` — đánh dấu subtask `[x]`, cập nhật status phase.
   - `.harness/agent/CURRENT_STATE.md` — Working Areas / Incomplete / invariant nếu đổi.
   - `docs/adr/NNN-*.md` — chỉ khi có quyết định kiến trúc mới (file mới, không sửa ADR cũ).
   - `docs/archive/completed_tasks/phase_N.md` — chỉ khi hoàn tất cả phase.
3. Tôn trọng size limit (`cx-scope-guards`). Không viết work-log có ngày tháng.
4. Không chạy `pnpm validate` (không có code đổi).

## Never
- Implement code trong workflow này.
- Sửa ADR cũ (tạo ADR mới, ghi "Supersedes ADR NNN").
- Append vào file archive đã đóng.
