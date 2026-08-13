# sk-session-startup

<!-- SKILL: Session Startup -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Đầu mỗi session, trước khi làm bất kỳ việc gì -->

Chạy đầu mỗi session. Mục tiêu: load đúng context + quyết định có cần orchestration.

## Step 1 — Load Context Bắt Buộc
```
Read AGENTS.md
Read .harness/agent/CURRENT_STATE.md
Read .harness/agent/ACTIVE_TASKS.md
```

## Step 2 — Đánh Giá Task Complexity
| Task là... | Quyết định |
|---|---|
| 1 câu hỏi / phân tích / review → text | Tự làm |
| 1 implementation đơn, scoped rõ | Tự làm |
| Cần audit/research trước khi implement | Orchestration |
| Nhiều task song song | Orchestration |
| Phase implementation (nhiều task liên tiếp) | Orchestration |
| Memory update / architecture question | Tự làm |

## Step 3 — Route + Budget
Đọc `.harness/workflows/wf-routing-heuristics.md`, match signal → chọn workflow → load skill được trigger.
**Ước lượng budget** (`cx-token-budget`): task này có vừa ≤ 40% context không? Nếu không → chia nhỏ
trước khi bắt đầu (đừng bắt đầu một task chắc chắn sẽ tràn).

## Step 4 — Orchestration (chỉ khi cần)
Đọc `.harness/agents/README.md` + `.harness/workflows/wf-orchestrate-session.md`, khởi tạo researcher/implementer.

## Step 5 — Xác nhận ngắn với người dùng
```
✅ Context: [phase hiện tại, task tiếp theo]
✅ Mode: [ORCHESTRATION / SINGLE-AGENT]
→ Sẵn sàng. Bắt đầu từ đâu?
```

## Ghi nhớ
- Subagent chỉ tồn tại trong session hiện tại — session mới phải khởi tạo lại.
- Không spawn subagent cho task đơn giản.
- Giữ context ≤ 40% (`cx-token-budget`) — chạm ngưỡng thì checkpoint + mở session mới.
