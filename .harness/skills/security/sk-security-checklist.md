# sk-security-checklist

<!-- SKILL: Security Checklist -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Mọi implementation task (bắt buộc) -->

Áp cho mọi file ghi/sửa. Chi tiết ở các skill security khác + `cx-hard-limits`.

## Với mỗi file thay đổi, xác nhận:
- [ ] **Không hardcode secret/token/connection string.** Dùng env; `.env.example` giá trị giả.
- [ ] **Auth:** không lưu credential thô; token nhạy cảm server-side; không trả token ra FE.
- [ ] **Ownership/IDOR:** mọi route `:id` có check ở service/guard. → `sk-idor-enforcement.md`
- [ ] **Mass assignment:** DTO dùng allowlist `@IsIn()`/`@IsEnum()`, không nhận field lạ.
- [ ] **Boundary:** không import chéo app; không business logic trong package type.
- [ ] **PII:** không đưa dữ liệu nhạy cảm vào URL/log; file nhạy cảm ở private storage. → `sk-pii-handling.md`
- [ ] **Audit:** ghi/sửa dữ liệu quan trọng kèm audit trong cùng transaction; không ghi đè im lặng.
- [ ] **Error handling:** không lộ stack trace/nội bộ ra HTTP; production trả message chung.
- [ ] **XSS:** không render HTML thô từ input người dùng thiếu sanitize.
- [ ] **CORS/JWT:** không wildcard origin + credentials; không thuật toán JWT `none`.
- [ ] **[DOMAIN]:** không vi phạm luật nghiệp vụ cốt lõi (`cx-hard-limits §DOMAIN`).

## High-risk surface (auth / ownership mới / AI / upload)
Nêu **rõ từng yêu cầu bảo mật** trong prompt; review chéo qua `wf-security-review.md` trước handoff.
