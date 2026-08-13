# wf-feature-implementation

<!-- WORKFLOW: Feature Implementation -->
<!-- AGENTS: Codex / Claude -->
<!-- MAX: 120 lines. -->

Workflow mặc định cho task `implement / build / add / create`.

## Skills để load
Luôn: `.harness/constraints/cx-hard-limits.md`, `.harness/skills/security/sk-security-checklist.md`.
Theo trigger (`wf-routing-heuristics.md §3`): backend module → `sk-nestjs-module-pattern`,
`sk-dto-validation`, `sk-api-response-rules`; ghi DB → `sk-prisma-data-rules`;
route có ownership → `sk-idor-enforcement`; domain → skill riêng của dự án.

## Steps
1. **Đọc scope.** Xác định surface và invariants liên quan (`cx-hard-limits`, kể cả §DOMAIN).
2. **Contract-first.** Đổi/thêm API → cập nhật `packages/contracts` **trước**.
3. **Đọc file liên quan trực tiếp.** Không quét cả repo (`cx-scope-guards`, `cx-token-budget`).
4. **Implement trong vùng file của vai.** Không chạm surface khác (tách composite nếu cần).
5. **Áp invariants** khi code: secret/env, ownership `:id`, validate input, audit-in-transaction,
   idempotency khi cần, không lộ lỗi nội bộ, + luật domain của dự án.
6. **Viết test** business rule (ownership, idempotency, regression, domain) — `Gate 2`.
7. **Chạy** `pnpm validate` — `Gate 1`.
8. **Self-check** security (`Gate 3`) + constraint (`Gate 5`).
9. **Handoff** — `.harness/skills/agent-ops/sk-handoff-protocol.md`.

## High-Security Variant
Kích hoạt khi task chạm auth / ownership mới / AI / upload. Bổ sung:
- Nêu **rõ từng yêu cầu bảo mật** ngay đầu (không suy diễn).
- Bắt buộc test: authorized / wrong-owner→Forbidden / not-found→NotFound.
- Review chéo bằng `wf-security-review.md` trước khi handoff.

## Definition of Done
Xem `.harness/constraints/cx-quality-gates.md`.
