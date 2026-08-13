# wf-bugfix-hotfix

<!-- WORKFLOW: Bug Fix / Hotfix -->
<!-- AGENTS: Codex / Claude -->
<!-- MAX: 120 lines. -->

Cho task `fix / debug / patch / hotfix`.

## Steps
1. **Tái hiện** lỗi. Xác định file/hàm gây lỗi (bắt đầu hẹp, không quét cả repo).
2. **Viết regression test** tái hiện lỗi trước khi sửa (test phải fail).
3. Sửa nguyên nhân gốc — không vá triệu chứng. Giữ trong scope, không dọn code ngoài lề.
4. Kiểm invariant: fix không được phá ownership / idempotency / audit / soft-ref.
5. Test regression pass + `pnpm validate`.
6. Handoff. Nếu lỗi lộ ra thiếu sót thiết kế → tạo follow-up task trong `ACTIVE_TASKS.md`.

## Never
- Sửa nhiều bug không liên quan trong một hotfix.
- Bỏ qua regression test ("để sau").
- Nới lỏng security để "cho chạy".
