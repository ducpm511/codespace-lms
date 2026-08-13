# wf-agent-routing

<!-- WORKFLOW: Agent Routing / Tool Selection (đa-vendor) -->
<!-- AGENTS: Human operator — dùng để chọn agent + workflow trước khi viết prompt -->
<!-- MAX: 120 lines. -->

File này là tham chiếu cho người vận hành (không phải agent tự load). Dùng để chọn đúng
tool + workflow cho một task trước khi viết prompt.

---

## Agent Selection

| Agent | Dùng cho |
|---|---|
| **Codex (ChatGPT)** | Implementation scoped, bugfix, refactor, schema migration, viết test, sửa file tập trung. Một task / prompt. |
| **Claude** | Tương tự Codex; mạnh review + có subagent native (`.claude/agents/`). Tốt cho task cần đọc-hiểu rộng rồi sửa. |
| **Gemini** | Phase planning, architecture review, thiết kế mơ hồ, review chéo module, phân rã composite. |

Tất cả đều đọc chung `AGENTS.md` + `.harness/constraints/` + `.harness/skills/`. Khác nhau ở điểm mạnh, không ở luật.

---

## Task → Agent + Workflow Map

| Task type | Agent | Workflow |
|---|---|---|
| Implement task scoped | Codex/Claude | `wf-feature-implementation.md` |
| High-risk (auth/IDOR/AI) | Codex/Claude | `wf-feature-implementation.md` (biến thể high-security) |
| Bugfix / hotfix | Codex/Claude | `wf-bugfix-hotfix.md` |
| Phân rã phase | Gemini | `wf-phase-planning.md` |
| Security / code review | Gemini (rộng) → Codex/Claude (fix) | `wf-security-review.md` |
| Schema + migration | Codex/Claude | `wf-schema-migration.md` |
| UI component / page | Codex/Claude | `wf-frontend-component.md` |
| Refactor | Codex/Claude | `wf-refactor.md` |
| Viết test thiếu | Codex/Claude | `wf-write-tests.md` |
| Update memory | bất kỳ | `wf-memory-update.md` |
| Architecture question | Gemini | `wf-architecture-question.md` |
| Composite multi-surface | Gemini phân rã → Codex/Claude từng lớp | `wf-composite-task.md` |

---

## Prompt Writing Rules

- **Codex/Claude prompt**: ngắn, scoped, một task, tham chiếu path chính xác.
- **Gemini prompt**: chấp nhận context rộng hơn, dùng cho planning/thiết kế mơ hồ.
- Kết mọi prompt implementation bằng: `Follow handoff: .harness/skills/agent-ops/sk-handoff-protocol.md`
- Task high-risk: nêu **rõ từng yêu cầu bảo mật** trong prompt, đừng để agent tự suy.
- Không gửi một prompt gộp nhiều task không liên quan.

---

## Context Budget

| Item | Cost | Load rule |
|---|---|---|
| `AGENTS.md` + `.harness/agent/` (3 file) | Low | Load đầu tiên |
| `.harness/skills/` file | Very low | Chỉ skill được trigger |
| `.harness/workflows/` file | Very low | Đúng 1 workflow liên quan |
| `docs/DESIGN.md` / ADR | Low | Phần liên quan |
| Source file | Medium | Chỉ file trong scope |
| `docs/archive/` | High | Không auto-load |

Bắt đầu hẹp. Mở rộng khi bị chặn.

---

## Ultra-Lean Prompt Pattern

```
Read AGENTS.md.
Read .harness/skills/security/sk-security-checklist.md.

Task: [MỘT CÂU]
Scope: [FILE CHÍNH XÁC]
Constraints: [DANH SÁCH NGẮN]

Follow handoff: .harness/skills/agent-ops/sk-handoff-protocol.md
```
