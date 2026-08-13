# wf-composite-task

<!-- WORKFLOW: Composite (schema + backend + frontend) -->
<!-- AGENTS: Gemini phân rã → Codex/Claude từng lớp -->
<!-- MAX: 120 lines. -->

Cho task trải nhiều surface như một deliverable (full-stack feature).

## Nguyên tắc
Không làm cả 3 surface trong một session. **Phân rã thành các sub-task một-surface**, nối bằng contracts.

## Steps
1. **Phân rã** (Gemini): chia thành lớp theo thứ tự phụ thuộc:
   ```
   ① contracts  → định nghĩa DTO/type API
   ② schema     → prisma model + migration (nếu cần)
   ③ backend    → module/endpoint đúng contract
   ④ frontend   → screen dùng contract
   ```
2. **Contracts trước** — chốt hợp đồng để ③ và ④ chạy song song.
3. Mỗi lớp là một sub-task riêng, route qua workflow tương ứng
   (`wf-schema-migration`, `wf-feature-implementation`, `wf-frontend-component`).
4. Mỗi lớp tự có quality gate + handoff.
5. Chạy song song ③ và ④ chỉ khi ① đã chốt (branch/worktree riêng để không đụng nhau).

## Never
- Đổi contracts giữa chừng mà không thông báo cho lớp phụ thuộc.
- Gộp backend + frontend vào một commit khó review.
