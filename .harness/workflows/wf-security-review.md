# wf-security-review

<!-- WORKFLOW: Security / Code Review -->
<!-- AGENTS: Gemini / researcher subagent (rộng) → Codex/Claude (fix) -->
<!-- MAX: 120 lines. -->

Cho task `review / audit / inspect`. Output là **analysis + findings**, không sửa code (fix ở task riêng).

## Skills
`.harness/skills/security/sk-security-checklist.md`, `.harness/skills/security/sk-idor-enforcement.md`,
`.harness/skills/security/sk-pii-handling.md`, `.harness/constraints/cx-hard-limits.md`.

## Checklist (theo INVARIANTS)
- [ ] Hardcode secret? token lộ ra FE?
- [ ] Route `:id` thiếu ownership check?
- [ ] Input không validate / DTO thiếu allowlist (mass assignment)?
- [ ] PII trong URL/log? file nhạy cảm ở public storage?
- [ ] Ghi domain không kèm audit trong cùng transaction? ghi đè im lặng?
- [ ] Thao tác nên idempotent nhưng insert mù (bản ghi trùng)?
- [ ] Import chéo app / business logic trong package type?
- [ ] Error message lộ nội bộ ra HTTP?
- [ ] Đổi API chưa cập nhật `packages/contracts`?
- [ ] **[DOMAIN]** vi phạm luật nghiệp vụ cốt lõi (`cx-hard-limits §DOMAIN`)?

## Steps
1. Xác định phạm vi review (module/diff). Đọc file trong phạm vi (một module/lần — `cx-token-budget`).
2. Chạy checklist. Mỗi finding: `file:line`, invariant bị phạm, kịch bản hỏng cụ thể, cách sửa.
3. Xếp theo mức nghiêm trọng. Nếu sạch, nói rõ đã đối chiếu hết checklist.
4. Có fix → tạo task, route qua `wf-bugfix-hotfix.md` / `wf-feature-implementation.md`.

## Never
- Tự sửa code trong workflow này (trừ khi được giao rõ).
