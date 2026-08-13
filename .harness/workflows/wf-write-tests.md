# wf-write-tests

<!-- WORKFLOW: Write Missing Tests -->
<!-- AGENTS: Codex / Claude -->
<!-- MAX: 120 lines. -->

Cho task thêm test cho code đã có. Test bám **hành vi**, không bám implementation.

## Skill
`.harness/skills/agent-ops/sk-test-coverage-rules.md`, `.harness/skills/security/sk-idor-enforcement.md`.

## Ưu tiên test (theo rủi ro)
1. **Ownership/IDOR** trên mọi route `:id`:
   authorized → OK · wrong-owner → Forbidden · not-found → NotFound.
2. **Idempotency** thao tác nên upsert: gọi 2 lần → đúng 1 bản ghi, giá trị cuối đúng.
3. **Audit**: ghi/sửa dữ liệu quan trọng → sinh audit record.
4. **DTO validation**: biên (thiếu field, sai enum, giá trị ngoài khoảng).
5. **Regression**: mỗi bug fix có test tái hiện lỗi.
6. **[DOMAIN]**: test luật nghiệp vụ đặc thù của dự án.

## Steps
1. Đọc code cần cover. Xác định nhánh chưa test.
2. Viết unit test (`*.spec.ts`) hoặc E2E (Playwright) theo bảng ưu tiên.
3. `pnpm validate` — test phải xanh, không giảm coverage.
4. Handoff.

## Never
- Bỏ nhánh unauthorized/not-found trong IDOR test.
- Test phụ thuộc thứ tự chạy hoặc state rò rỉ giữa test.
