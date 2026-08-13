# sk-context-loading-rules

<!-- SKILL: Context Loading Rules -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Khi quyết định đọc file nào / mở rộng context -->

Token discipline: bắt đầu hẹp, mở rộng khi bị chặn, dừng khi đủ.

## Thứ tự mở rộng (chỉ khi cần)
```
1. File .harness/agent/ đã load           → dùng cái đang có
2. Skill được trigger            → 1 file
3. Workflow liên quan            → 1 file
4. docs/DESIGN.md / ADR     → phần liên quan
5. Source file trong scope       → đúng file
6. docs/archive/                 → chỉ khi debug lịch sử
```

## Không bao giờ
- Quét cả repo để "hiểu tổng thể" trước khi làm task scoped.
- Load `docs/archive/` tự động.
- Đọc lại file đã có trong context.
- Dùng lịch sử chat làm nguồn sự thật (memory sống trong .harness/agent/ + docs/).

## Luôn load (mọi implementation task)
```
.harness/constraints/cx-hard-limits.md
.harness/skills/security/sk-security-checklist.md
```

## Dấu hiệu nên dừng mở rộng
Đã đủ để: xác định file cần sửa, biết invariant liên quan, biết test cần viết. → Bắt tay làm.
