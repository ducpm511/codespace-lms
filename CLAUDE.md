# CLAUDE.md — CodeSpace LMS (Claude Code entry)

> ⚠️ Entry chung cho MỌI agent là **[AGENTS.md](AGENTS.md)** — đọc và theo file đó trước.
> File này chỉ bổ sung phần riêng của Claude Code.

@AGENTS.md

---

## Riêng cho Claude Code

- **Subagent native** ở `.claude/agents/`: `backend`, `frontend`, `reviewer` — bản Claude của các
  vai định nghĩa trong `.harness/agents/` (vendor-neutral). Luật vẫn nằm ở `.harness/constraints/` + `.harness/skills/`.
- **Permission allowlist** ở `.claude/settings.json` để giảm prompt.
- Bắt đầu session: theo "Default Startup Sequence" trong AGENTS.md → chạy
  `.harness/skills/agent-ops/sk-session-startup.md`.
