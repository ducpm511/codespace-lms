# sk-api-response-rules

<!-- SKILL: API Response & Error Rules -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: error handling, exception, HTTP status, response shape -->

## Response shape
- Trả đúng type khai báo trong `packages/contracts`. Không "đổ" toàn bộ record — chỉ field cần cho
  màn hình (tránh lộ PII/field nội bộ).
- List có pagination thống nhất: `{ items, total, page, pageSize }` (hoặc cursor).

## HTTP status
| Tình huống | Status |
|---|---|
| Không đăng nhập / session hết hạn | 401 |
| Đăng nhập nhưng không có quyền/không sở hữu | 403 |
| Resource không tồn tại | 404 |
| Validation fail | 400 (chi tiết field, không lộ nội bộ) |
| Ghi thành công | 200/201 |

## Error handling
- Dùng NestJS exceptions (`ForbiddenException`, `NotFoundException`, ...).
- **Không lộ stack trace/message nội bộ** ra client ở production — log server-side, trả message chung.

## Idempotency
- Endpoint ghi nên idempotent dùng `PUT` (upsert) — gọi lại an toàn, không nhân đôi.

## Không
- Trả `error.message` thô của Prisma/exception ra HTTP.
- Response shape khác nhau giữa các endpoint cùng loại.
