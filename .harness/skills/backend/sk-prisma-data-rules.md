# sk-prisma-data-rules

<!-- SKILL: Prisma Data Rules -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: ghi DB, upsert, Decimal, transaction, audit -->

## Upsert idempotent
Thao tác nên idempotent (client có thể retry/mạng lag) → `upsert` trên unique key, KHÔNG `create` mù.
```ts
await prisma.item.upsert({
  where: { uniqueKey: { ownerId, slotId } },
  create: { ownerId, slotId, value, createdBy },
  update: { value, updatedAt: new Date() },
});
```
Bulk: gói nhiều upsert trong `$transaction`.

## Decimal cho giá trị chính xác
- Tiền/điểm/tỉ lệ dùng `Prisma.Decimal`, không native `number` khi tính/tổng.
- Validate khoảng hợp lệ trước khi ghi.

## Audit trong transaction
- Ghi/sửa dữ liệu quan trọng → ghi audit (old→new, changedBy) trong **cùng `$transaction`**.
- Không ghi đè im lặng. Không audit ngoài transaction.

## Soft-ref tới hệ thống ngoài (nếu có)
- Tham chiếu tới ID của hệ thống ngoài: lưu string + index, cân nhắc **không** FK cứng nếu dữ liệu
  đồng bộ có độ trễ (eventual consistency). Tham chiếu nội bộ thì FK cứng.

## [DOMAIN]
- _(điền luật ghi dữ liệu đặc thù: giá trị mặc định, điều kiện tạo bản ghi, quan hệ bắt buộc...)_

## Không
- `create` cho thao tác nên upsert; `Float` cho giá trị cần chính xác; audit ngoài transaction.
