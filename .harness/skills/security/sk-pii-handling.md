# sk-pii-handling

<!-- SKILL: PII Handling -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: dữ liệu người dùng nhạy cảm, upload file/ảnh, gọi LLM -->

Xác định dữ liệu nhạy cảm của dự án (tên, liên hệ, ảnh, ID định danh...) và bảo vệ.

## Storage file nhạy cảm
- **Private bucket + signed URL** (hết hạn ngắn). KHÔNG public URL.
- **Retention:** xóa dữ liệu gốc khi không còn cần (config), chỉ giữ phần tối thiểu cho audit.
- Không đưa file/PII vào log, không vào URL query.

## Gửi ra LLM / bên thứ ba
- Chỉ gửi dữ liệu cần cho tác vụ. Ẩn/loại PII thừa trước khi gửi.
- Ghi log mỗi lần gửi (audit): ai, dữ liệu gì, khi nào.
- Cần thỏa thuận xử lý dữ liệu (DPA) với nhà cung cấp — nêu nếu chưa có.

## Hiển thị & truyền
- Không đặt PII trong URL query string.
- Access control theo role: chỉ người có quyền thấy PII liên quan.
- Response API chỉ trả field cần cho màn hình, không "đổ" toàn bộ record.

## Không
- Public bucket cho file nhạy cảm.
- PII trong URL/log/analytics bên thứ ba.
- Giữ dữ liệu nhạy cảm vô thời hạn.
