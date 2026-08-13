# sk-prisma-migration

<!-- SKILL: Prisma Migration -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: migration, schema change, add model/field/index -->

## Quy trình
```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name <kebab-mô-tả>   # vd: add-item-audit-log
npx prisma generate
```

## Nguyên tắc
- Tên migration mô tả rõ. **Không sửa migration đã commit** — tạo migration mới để đắp.
- Thêm unique/index qua migration, không sửa DB tay.
- Migration production: review kỹ, backup, chạy có kiểm soát (không `migrate reset` trên prod).
- Đổi cột có dữ liệu: cân nhắc backfill trong migration hoặc script riêng.

## Sau migration
- Cập nhật `docs/DESIGN.md` nếu mô hình đổi; `CURRENT_STATE.md` (schema changed).
- Thêm test cho bảng mới nếu liên quan luật nghiệp vụ.

## Không
- `prisma db push` cho thay đổi cần lịch sử migration (chỉ prototype nhanh).
- Sửa file migration cũ; reset DB có dữ liệu thật.
