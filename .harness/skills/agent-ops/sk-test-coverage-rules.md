# sk-test-coverage-rules

<!-- SKILL: Test Coverage Rules -->
<!-- MAX: 80 lines. -->
<!-- TRIGGER: Task thêm/đổi logic, hoặc viết test -->

Test bám **hành vi**, không bám implementation. Ưu tiên theo rủi ro.

## Bắt buộc theo loại thay đổi
| Thay đổi | Test |
|---|---|
| Service method mới | `*.service.spec.ts` |
| Controller endpoint mới | `*.controller.spec.ts` |
| DTO mới | Test biên validation (thiếu field, sai enum, giá trị ngoài khoảng) |
| Route `:id` (ownership) | Ownership test (3 nhánh) |
| Thao tác idempotent | Idempotency test |
| Ghi có audit | Test sinh audit record |
| Bug fix | Regression test tái hiện lỗi |
| [DOMAIN] | Test luật nghiệp vụ đặc thù |

## Ownership test tối thiểu (3 nhánh)
```
1. Người sở hữu     → success
2. Không sở hữu     → ForbiddenException
3. ID không tồn tại → NotFoundException
```

## Idempotency test tối thiểu
```
PUT cùng payload hai lần → đúng 1 bản ghi; giá trị cuối đúng.
PUT payload mới           → vẫn 1 bản ghi; giá trị cập nhật (upsert, không nhân đôi).
```

## Không
- Bỏ nhánh unauthorized/not-found trong IDOR test.
- Test phụ thuộc thứ tự chạy hoặc state rò rỉ giữa test.
