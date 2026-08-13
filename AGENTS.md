# AGENTS.md — CodeSpace LMS Agent Guide

<!-- SIZE LIMIT: 150 lines. Do not exceed. Extract content to a skill/workflow if approaching. -->

> **Entry point cho MỌI AI agent** (ChatGPT/Codex, Gemini, Claude, …). Codex đọc file này mặc định;
> `CLAUDE.md` và `GEMINI.md` chỉ trỏ về đây. Đừng chép nội dung ra nơi khác — sửa luật ở 1 chỗ.

Hệ thống quản lý học tập trực tuyến trực thuộc Công ty TNHH CodeSpace Việt Nam. Cung cấp nền tảng phục vụ việc học tập Lập trình, STEAM, AI tại CodeSpace. Tối ưu cho việc học tập lập trình Scratch và Python

## Read This First

Constraints áp dụng mọi task, không ngoại lệ:
→ `.harness/constraints/cx-hard-limits.md` — cấm tuyệt đối
→ `.harness/constraints/cx-scope-guards.md` — ranh giới scope & size
→ `.harness/constraints/cx-quality-gates.md` — cổng pass/fail trước handoff
→ `.harness/constraints/cx-token-budget.md` — giữ context ≤ 40% (chống ảo giác)

Không chắc dùng workflow nào? → `.harness/workflows/wf-routing-heuristics.md`

## Default Startup Sequence

1. Đọc file này (`AGENTS.md`)
2. Đọc `.harness/agent/CURRENT_STATE.md`
3. Đọc `.harness/agent/ACTIVE_TASKS.md`
4. Chạy `.harness/skills/agent-ops/sk-session-startup.md` — đánh giá complexity, bật orchestration nếu cần
5. Route task → `.harness/workflows/wf-routing-heuristics.md`
6. Load workflow đã chọn
7. Load skill được trigger (danh sách skill nằm trong workflow)
8. Chỉ đọc source file liên quan trực tiếp tới task
9. Load docs theo nhu cầu, mỗi lần một file

## Always-Load Documents

- `AGENTS.md` (this file)
- `.harness/agent/CURRENT_STATE.md`
- `.harness/agent/ACTIVE_TASKS.md`
- `.harness/skills/agent-ops/sk-session-startup.md`

## 🔒 INVARIANTS

> ⚠️ **ĐIỀN cho dự án của bạn.** Danh sách dưới là invariant kỹ thuật generic áp dụng rộng.
> Thêm invariant **domain** (nguồn sự thật dữ liệu, luật nghiệp vụ) — chi tiết `.harness/constraints/cx-hard-limits.md §DOMAIN`.

1. **Không hardcode secret/token/password.** Dùng env; `.env.example` giá trị giả.
2. **Ranh giới module:** không import chéo giữa các app; logic dùng chung ở package riêng.
3. **Ownership/IDOR:** mọi route `:id` kiểm quyền sở hữu ở service/guard. → `.harness/skills/security/sk-idor-enforcement.md`
4. **Validate input ở biên** bằng DTO allowlist (chống mass assignment).
5. **PII:** không đưa dữ liệu nhạy cảm vào URL/log; file nhạy cảm ở private storage. → `.harness/skills/security/sk-pii-handling.md`
6. **Audit + ghi domain trong cùng transaction.** Không ghi đè dữ liệu quan trọng im lặng.
7. **Không lộ stack trace/nội bộ ra HTTP client** (production trả message chung).
8. **Timestamp UTC.** Giá trị cần chính xác dùng Decimal, không Float.
9. **[DOMAIN]** _(điền: nguồn sự thật, luật nghiệp vụ cốt lõi của dự án)_

Nếu một task buộc phá invariant → **dừng và escalate cho con người**, không tự quyết.

## Quick File Map

> _(Điền sau khi scaffold app.)_
- `apps/api/src/<module>/` — backend module
- `apps/web/src/` — frontend
- `packages/contracts/src/` — DTO/type dùng chung FE↔BE

## Tool Selection (đa-vendor)

Chi tiết: `.harness/workflows/wf-agent-routing.md`
- **Codex (ChatGPT)** — implementation scoped, refactor, schema, viết test. Một task / prompt.
- **Gemini** — planning, review rộng, thiết kế mơ hồ, phân rã composite task.
- **Claude** — implementation + review; có subagent native ở `.claude/agents/`.

## Token Discipline

Giữ context mỗi session **≤ 40%** cửa sổ model — context đầy làm agent ảo giác & quên luật.
Chạm 40% → checkpoint, handoff ra file, mở session mới. → `.harness/constraints/cx-token-budget.md`

## Handoff

Sau mỗi task: cập nhật `.harness/agent/ACTIVE_TASKS.md` + `.harness/agent/CURRENT_STATE.md`.
Đầy đủ: `.harness/skills/agent-ops/sk-handoff-protocol.md` · gate: `.harness/constraints/cx-quality-gates.md`

## Giao tiếp

_(Điền ngôn ngữ trao đổi ưu tiên; code/identifier/commit thường bằng tiếng Anh.)_
