# cx-quality-gates

<!-- CONSTRAINTS: Quality Gates -->
<!-- SCOPE: All agents. Applied before every handoff. -->
<!-- MAX: 80 lines. -->

Cổng pass/fail phải đạt trước khi handoff. Task CHƯA xong nếu còn gate fail.

---

## Gate 1 — Validation Suite
**Áp dụng:** mọi task implementation.
```bash
pnpm validate      # lint + type-check + unit test
```
Zero lint error, zero type error, test xanh.
**Ngoại lệ:** `wf-memory-update.md`, `wf-architecture-question.md` — không đổi code, bỏ qua gate.

---

## Gate 2 — Test Coverage
**Áp dụng:** mọi task thêm/đổi application logic.

| Loại thay đổi | Test bắt buộc |
|---|---|
| Service method mới | Unit test `*.service.spec.ts` |
| Controller endpoint mới | Unit test `*.controller.spec.ts` |
| DTO mới | Test biên validation |
| Route `:id` (ownership) | Ownership test: authorized / wrong-owner→Forbidden / not-found→NotFound |
| Thao tác idempotent | Idempotency test (gọi 2 lần → 1 kết quả) |
| Ghi có audit | Test sinh audit record |
| Bug fix | Regression test tái hiện lỗi gốc |
| _(domain)_ | _(điền test cho luật nghiệp vụ đặc thù)_ |

---

## Gate 3 — Security Checklist
**Áp dụng:** mọi task ghi/sửa code. Đầy đủ: `.harness/skills/security/sk-security-checklist.md`.
- [ ] Không hardcode secret · [ ] Ownership check trên route `:id`
- [ ] DTO allowlist (`@IsIn`/`@IsEnum`) · [ ] Không PII trong URL/log
- [ ] Không lộ lỗi nội bộ ra HTTP

---

## Gate 4 — Handoff Files Updated
| File | Điều kiện |
|---|---|
| `.harness/agent/ACTIVE_TASKS.md` | Luôn |
| `.harness/agent/CURRENT_STATE.md` | Nếu đổi state hệ thống |
| `docs/adr/NNN-*.md` | Chỉ khi có quyết định kiến trúc mới |
| `docs/archive/completed_tasks/` | Chỉ khi hoàn tất cả phase |

Đầy đủ: `.harness/skills/agent-ops/sk-handoff-protocol.md`.

---

## Gate 5 — Constraint Compliance
Tự soát theo `.harness/constraints/cx-hard-limits.md` (security + data integrity + boundaries + **domain**).

---

## Gate 6 — File Size & Context Budget
- File .harness/agent/.harness/skills/.harness/workflows/constraints vượt size limit (`cx-scope-guards.md`) → refactor trước.
- Session > 40% context (`cx-token-budget.md`) → checkpoint, không nhận thêm task.

---

## Escalation
Gate fail không giải quyết được trong scope → dừng, không handoff, tạo follow-up task trong `ACTIVE_TASKS.md`.
