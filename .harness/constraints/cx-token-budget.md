# cx-token-budget

<!-- CONSTRAINTS: Token / Context Budget -->
<!-- SCOPE: All agents. All tasks. No exceptions. -->
<!-- MAX: 80 lines. -->

Giữ context của mỗi session **≤ 40% cửa sổ context của model**.
Lý do: context càng đầy, agent càng dễ **ảo giác**, quên luật (constraints), và trộn lẫn thông tin
("context rot"). 40% để chừa chỗ cho suy luận + output và giữ tín hiệu quan trọng không bị loãng.

---

## Ngưỡng

| Mức dùng | Hành động |
|---|---|
| < 30% | Bình thường — làm việc. |
| 30–40% | **Cảnh giác.** Ưu tiên hoàn thành, tránh load thêm file không thiết yếu. |
| ≥ 40% | **DỪNG mở rộng.** Checkpoint: handoff state ra file → mở session mới cho phần còn lại. |

Không "cố làm nốt" khi đã chạm 40%. Chất lượng ở 60–90% context thấp hơn nhiều so với khi bắt đầu tươi.

---

## Checkpoint reminder ở ngưỡng (BẮT BUỘC phát ra)

Agent **không tự mở được session mới** — chỉ người dùng mở. Nên khi chạm ~40% (hoặc tool báo sắp nén),
việc bắt buộc là **dừng + phát ra một "Session Checkpoint"** cho người dùng, gồm:

1. Một dòng trạng thái: đã xong gì / đang dở gì.
2. Xác nhận state đã ghi ra file (`.harness/agent/CURRENT_STATE.md`, `ACTIVE_TASKS.md`).
3. **Resume prompt (tiếng Anh)** sẵn để dán vào phiên mới — theo mẫu:

```text
Read AGENTS.md + .harness/agent/CURRENT_STATE.md + .harness/agent/ACTIVE_TASKS.md.
Context: <what is done, committed, and green>.
Known issues: <blockers / env notes>.
Next:
1) <immediate task or decision>
2) <next scoped task> — one surface, keep context <= 40%.
```

Sau đó DỪNG, để người dùng mở phiên mới. Không tiếp tục làm dù còn việc.

---

## Cách tuân thủ (cơ chế chính = chia nhỏ task)

1. **One task / one surface / one module per session** (xem `cx-scope-guards`). Đây là cách giữ budget
   quan trọng nhất — task nhỏ thì context không bao giờ phình.
2. **Load-on-demand**, không quét repo, không auto-load `docs/archive/` (xem `sk-context-loading-rules`).
3. **Giới hạn số file mở:** nếu phải đọc > ~10–15 file mới hiểu được task → task quá to, **chia nhỏ** trước khi làm.
4. **Checkpoint sớm:** khi ước lượng ~40% (hoặc tool báo sắp nén/summarize) → ghi tiến độ vào
   `.harness/agent/ACTIVE_TASKS.md` + TODO trong code, rồi bàn giao. Session mới đọc lại từ file, không từ chat.
5. **Phase-planning phải chia task đủ nhỏ** để mỗi task vừa 40% (xem `wf-phase-planning`).

---

## Cách đo theo tool

- **Claude Code:** dùng `/context` để xem %; auto-compact kích hoạt khi gần đầy — hãy checkpoint
  **chủ động TRƯỚC** ngưỡng đó (đừng để tool tự nén rồi mất mạch).
- **Codex / Gemini:** thường không có counter tin cậy → dùng **proxy**: số file đã mở, độ dài hội thoại,
  số lần lặp. Chia task nhỏ ngay từ đầu thay vì đo giữa chừng.

---

## Never

- Nhồi cả tài liệu/nhiều module vào một session để "làm cho xong".
- Tiếp tục implement khi context đã > 40% thay vì checkpoint.
- Dựa vào trí nhớ hội thoại dài thay vì đọc lại state từ file (chat dài = nguồn ảo giác).
- Đọc lại file đã có trong context (lãng phí budget).
