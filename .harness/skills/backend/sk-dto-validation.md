# sk-dto-validation

<!-- SKILL: DTO Validation -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: DTO, validation, request body, input -->

Input không tin cậy. Validate ở biên bằng DTO + `class-validator`, allowlist.

## Nguyên tắc
- DTO **import type từ `packages/contracts`** làm hợp đồng; thêm decorator validate.
- Bật `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` → chống mass assignment.
- Enum/giá trị cố định dùng `@IsEnum()` / `@IsIn()` — không nhận chuỗi tự do.
- Số có ràng buộc: `@IsNumber()` + `@Min()` + `@Max()`. ID: `@IsString()` (+ format nếu có).
  Ngày: ISO, chuẩn hóa UTC.

## Ví dụ
```ts
class CreateItemDto {
  @IsString() name: string;
  @IsIn(['a', 'b', 'c']) kind: string;
  @IsNumber() @Min(0) amount: number;
}
```

## Không
- Nhận field ngoài allowlist (mass assignment).
- Validate bằng if/else thủ công ở controller thay vì DTO.
- Tin `role`/`ownership` gửi từ client.
