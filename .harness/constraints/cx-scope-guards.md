# cx-scope-guards

<!-- CONSTRAINTS: Scope Guards -->
<!-- SCOPE: All agents. Applied when planning scope and expanding context. -->
<!-- MAX: 80 lines. -->

Áp trước khi bắt đầu task và bất cứ khi nào bị cám dỗ mở rộng scope.

---

## File Size Guards

| File | Hard limit | Nếu chạm |
|---|---|---|
| `AGENTS.md` | 150 dòng | Tách nội dung sang skill/workflow |
| `.harness/agent/CURRENT_STATE.md` | 500 dòng | Tách phần phình ra doc riêng |
| `.harness/agent/ACTIVE_TASKS.md` | 200 dòng | Đưa phase xong vào archive; thêm phase mới |
| skill trong `.harness/skills/` | 80 dòng | Tách thành 2 skill |
| workflow trong `.harness/workflows/` | 120 dòng | Tách hoặc ủy thác sub-workflow |
| constraint trong `.harness/constraints/` | 80 dòng | Tách theo mối quan tâm |

Sắp vượt limit → **dừng, refactor cấu trúc file trước**.

---

## Context Expansion Guards

Chỉ mở rộng khi bị chặn, theo đúng thứ tự:

```
1. File .harness/agent/ đã load        → dùng cái đang có
2. Một skill file             → load đúng skill được trigger
3. Một workflow file          → load đúng workflow liên quan
4. docs/DESIGN.md / ADR  → phần liên quan
5. Một source file            → đúng file trong scope
6. docs/archive/              → chỉ khi debug lịch sử
```

Dừng mở rộng ngay khi đủ ngữ cảnh để làm.

---

## Task Scope Guards

| Guard | Rule |
|---|---|
| One task per session | Không gộp nhiều task rời rạc vào một prompt |
| One workflow per session | Không nối workflow trừ khi dùng `wf-composite-task.md` |
| One module per session | Không rải một session qua nhiều module không liên quan |
| One surface per session | Không trộn backend + frontend + migration (trừ composite) |
| No scope creep | Thay đổi ngoài scope → task riêng |

---

## Monorepo Import Guards

Chiều import hợp lệ:

```
apps/web  →  packages/contracts   ✅
apps/api  →  packages/contracts   ✅
apps/web  →  apps/api             ❌ FORBIDDEN
apps/api  →  apps/web             ❌ FORBIDDEN
packages/contracts → apps/*       ❌ FORBIDDEN (contracts không import từ apps)
```

---

## Ownership Guards (ai ghi file nào — tránh xung đột song song)

| Vai | Được ghi | Chỉ đọc |
|---|---|---|
| Backend | `apps/api/**`, `prisma/**` | `packages/contracts` |
| Frontend | `apps/web/**` | `packages/contracts` |
| Contracts | `packages/contracts/**` | — |
| Researcher/Reviewer | *(không ghi)* | toàn repo |

Đổi API shape → sửa `packages/contracts` **trước**, rồi backend & frontend mới theo.

---

## Output Guards

- Không viết work-log có ngày tháng vào .harness/agent/ hay docs/.
- Không copy nội dung đã tồn tại trong skill/doc khác.
- Agent file chứa state + instruction, không phải kể chuyện.
- Không nhúng constraint vào bước workflow — tham chiếu file constraint.
