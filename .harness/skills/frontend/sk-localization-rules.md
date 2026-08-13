# sk-localization-rules

<!-- SKILL: Localization Rules -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: i18n, localization, vi/en, translation -->

Giao diện chính tiếng Việt; hỗ trợ đa ngôn ngữ ngay từ đầu để không phải bóc chuỗi sau.

## Nguyên tắc
- Không hardcode chuỗi hiển thị trong component — dùng khóa i18n (`t('...')`).
- File dịch: `vi.json` (mặc định) + `en.json`. Khóa phân cấp theo màn hình/feature.
- Số/ngày/giờ format theo locale + timezone trung tâm (hiển thị local, dữ liệu UTC).
- Thuật ngữ song ngữ theo tài liệu: "Session Points / Điểm buổi học", giữ nhất quán.

## Không
- Ghép chuỗi dịch bằng nối chuỗi (dùng interpolation của i18n).
- Hardcode "Điểm danh", "Present"... trực tiếp trong JSX.
- Trộn ngôn ngữ trong cùng một khóa.
