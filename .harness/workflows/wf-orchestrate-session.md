# wf-orchestrate-session

<!-- WORKFLOW: Orchestration Session Setup -->
<!-- AGENTS: Orchestrator (Gemini/Claude) -->
<!-- MAX: 120 lines. -->

Cho session cần nhiều subagent (audit trước khi implement, hoặc nhiều task song song).
Xem mô hình: `.harness/agents/README.md`.

## Khi nào cần orchestration
| Tình huống | Pattern |
|---|---|
| 1 task đơn, scoped | Tự làm — không spawn |
| Cần audit/research trước khi implement | Spawn researcher → thu findings → spawn implementer |
| Nhiều task độc lập | Spawn nhiều implementer song song (worktree/branch riêng) |
| Review bảo mật toàn module | Spawn researcher song song theo module |

## Steps
1. Chạy `.harness/skills/agent-ops/sk-session-startup.md` (load context, đánh giá complexity).
2. Nếu cần: khởi tạo subagent theo định nghĩa:
   - `.harness/agents/ag-researcher.md` — read-only, dùng cho audit/analysis.
   - `.harness/agents/ag-implementer.md` — full tools, workspace cô lập (branch/worktree).
3. Giao task cho subagent kèm: file cần đọc (AGENTS.md + constraints), scope file chính xác,
   yêu cầu handoff. Task song song chỉ khi **không có dependency** (xem `ACTIVE_TASKS.md` cột Order).
4. Thu báo cáo từ subagent → tổng hợp → cập nhật memory.

## Claude-native
Claude dùng Agent tool + `.claude/agents/{backend,frontend,reviewer}.md`. Mỗi worktree cô lập.

## Never
- Spawn song song các task có dependency lẫn nhau.
- Để subagent tự ý mở rộng scope ngoài task được giao.
