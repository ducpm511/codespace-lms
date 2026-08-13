# sk-ui-design-system

<!-- SKILL: UI Design System -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: component, page, UI, Tailwind, card -->

> ⚠️ **Điều chỉnh tông/phong cách theo thương hiệu dự án.** Dưới là nguyên tắc kỹ thuật chung.

## Token, không hardcode
- Màu, spacing, radius, typography định nghĩa trong theme (Tailwind config), dùng qua token.
- Không hardcode giá trị màu/khoảng cách trong component.

## Component
- Tái sử dụng; responsive; accessibility cơ bản (contrast đủ, target chạm đủ lớn, label rõ).
- Trạng thái đầy đủ: empty state, loading skeleton, error state.
- Hành động chính đặt gần ngữ cảnh sử dụng.

## Cân bằng
- Ưu tiên **dễ scan** cho màn hình mật độ dữ liệu cao (bảng, danh sách). Trang trí không được làm
  chậm thao tác chính.
- Nhất quán component/pattern toàn app.

## [DOMAIN / BRAND]
- _(điền: bảng màu thương hiệu, thành phần đặc trưng, tông giao diện)_

## Không
- Hardcode màu/spacing ngoài token.
- Trang trí gây nhiễu thao tác chính.
