# Agents — CodeSpace LMS Orchestration

Updated: 2026-07-18

## Mô hình

```
Bạn → Orchestrator (Gemini / Claude)
           │
           ├─ ag-researcher  → đọc code, audit bảo mật, phân tích
           │   (read-only)          báo cáo findings về orchestrator
           │
           └─ ag-implementer → implement task, viết file, chạy lệnh
               (full tools)         handoff xong → báo cáo về orchestrator
```

Bạn chỉ nói chuyện với orchestrator; nó điều phối phần còn lại.
Đây là mô hình **trung lập vendor** — mỗi tool hiện thực bằng cơ chế riêng (xem dưới).

## Hai loại subagent

| Agent | File định nghĩa | Quyền | Workspace | Dùng cho |
|---|---|---|---|---|
| `ag-researcher` | `.harness/agents/ag-researcher.md` | read-only | inherit | Audit, review, phân tích, tìm kiếm |
| `ag-implementer` | `.harness/agents/ag-implementer.md` | full | branch/worktree | Implement, viết code, chạy lệnh |

## Khi nào orchestration

| Tình huống | Pattern |
|---|---|
| 1 task đơn | Tự làm — không spawn |
| Audit trước khi implement | researcher → findings → implementer |
| Nhiều task độc lập | nhiều implementer song song (workspace cô lập) |
| Security review toàn module | researcher song song theo module |

Chỉ spawn song song khi task **không có dependency** (xem `.harness/agent/ACTIVE_TASKS.md` cột Order).

## Hiện thực theo tool

- **Claude Code**: subagent native ở `.claude/agents/{backend,frontend,reviewer}.md` + Agent tool;
  worktree cô lập cho task song song.
- **Gemini / Codex**: người vận hành spawn agent theo vai, dán system prompt từ file `ag-*.md`,
  làm việc trên branch/worktree riêng.

Luật (.harness/constraints/skills) là chung cho mọi vai — subagent chỉ khác quyền và workspace.
