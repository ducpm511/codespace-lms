# wf-frontend-component

<!-- WORKFLOW: Frontend Component / Page -->
<!-- AGENTS: Codex / Claude -->
<!-- MAX: 120 lines. -->

Cho task UI: component, screen, page trong `apps/web`.

## Skills
`.harness/skills/frontend/sk-ui-design-system.md`, `.harness/skills/frontend/sk-react-query-patterns.md`,
`.harness/skills/frontend/sk-localization-rules.md`, `.harness/skills/security/sk-security-checklist.md`.

## Steps
1. Đọc yêu cầu UX ở `docs/DESIGN.md`.
2. Import type từ `packages/contracts` — **không tự đoán shape**. Thiếu type → cập nhật contracts trước.
3. Dùng **TanStack Query** cho fetch/cache/mutation. Với thao tác ghi nhanh/nhiều: **optimistic + rollback**.
4. Style theo design system (`sk-ui-design-system`); dùng token, không hardcode màu/spacing.
5. Không đưa PII vào URL query; không giữ token ở FE.
6. Empty/loading/error state rõ ràng. Text qua i18n (`sk-localization-rules`).
7. Test: E2E flow chính (Playwright) nếu là luồng người dùng mới.
8. `pnpm validate`, rồi handoff.

## Never
- FE gọi hệ thống ngoài trực tiếp (đi qua backend).
- Hardcode giá trị ngoài token theme.
- Tự chế shape dữ liệu thay vì dùng contracts.
