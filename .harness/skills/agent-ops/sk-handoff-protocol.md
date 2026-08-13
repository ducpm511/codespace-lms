# sk-handoff-protocol

<!-- SKILL: Handoff Protocol -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Cuối mỗi task, trước khi đóng session -->

Chạy trước khi tuyên bố task xong. Gate phải pass trước: `.harness/constraints/cx-quality-gates.md`.

## Step 0 — Checkpoint giữa chừng (nếu context ~40%)
Nếu chạm ngưỡng `cx-token-budget` khi task CHƯA xong: đừng cố làm nốt.
→ Ghi tiến độ + việc còn lại vào `.harness/agent/ACTIVE_TASKS.md` (rõ file/đầu việc kế tiếp) + `// TODO(scope):`
   trong code. Commit phần đang dở nếu an toàn. Mở session mới đọc lại từ file — không nối chat dài.

## Step 1 — Luôn cập nhật (mọi task)
```
.harness/agent/ACTIVE_TASKS.md
  → Đánh dấu subtask [x]; cập nhật status phase nếu xong hết. Giữ ≤200 dòng.
.harness/agent/CURRENT_STATE.md
  → Cập nhật Working Areas nếu có feature mới stable; Incomplete nếu gap đổi. Giữ ≤500 dòng.
```

## Step 2 — Chỉ khi có quyết định kiến trúc mới
```
docs/adr/NNN-kebab-title.md   (file mới, số kế tiếp)
  → Date, Status, Decision (D-number + statement), Why.
  → Không sửa ADR cũ. Nếu thay thế: ghi "Supersedes ADR NNN".
```

## Step 3 — Chỉ khi hoàn tất cả một phase
```
docs/archive/completed_tasks/phase_N_name.md   (file mới, ≤60 dòng)
  → Outcome + tác động migration. Không log thô, không diff đầy đủ.
.harness/agent/ACTIVE_TASKS.md → thay block phase xong bằng phase kế tiếp.
```

## Step 4 — Chỉ khi các thứ này đổi
| File | Điều kiện |
|---|---|
| `docs/DESIGN.md` | Mô hình dữ liệu / quyết định kỹ thuật đổi |
| `prisma/schema.prisma` | Schema đổi (kèm migration) |
| `packages/contracts` | API shape đổi |

## Báo cáo handoff (khi là subagent, gửi về orchestrator)
```
## Report: [TASK]
### Status: COMPLETE / BLOCKED
### Files changed: [list]
### Tests: PASS / FAIL   ### validate: PASS / FAIL
### Notes: [quyết định / vấn đề]
```

## Forbidden sau task thường
- Append vào file archive đã đóng.
- Sửa `docs/DESIGN.md`/schema/contracts khi không thực sự đổi.
