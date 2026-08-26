-- === Data migration — cấp `course.delete` cho vai trò `instructor` ===
--
-- Giáo viên tạo được khóa học nhưng KHÔNG xóa được khóa của chính mình (DELETE trả 403), phải
-- nhờ admin. Rào chắn thật nằm ở service: khóa đang gán cho lớp thì từ chối xóa (409), nên quyền
-- này chỉ đụng được tới khóa chưa dùng.
--
-- Vì sao nằm ở migration chứ không chỉ ở `seed.cjs`: `ops/release.sh` chạy `prisma migrate deploy`
-- nhưng KHÔNG chạy seed — seed chỉ chạy đúng một lần lúc dựng máy (RUNBOOK §2). Sửa mỗi seed thì
-- quyền không bao giờ tới production và không có gì báo lỗi.
--
-- Idempotent: chạy lại không nhân bản. Thiếu role/permission thì INSERT không chèn dòng nào
-- (SELECT rỗng) chứ không nổ.
INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT 'rp_instructor_course_delete', r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.key = 'instructor' AND p.key = 'course.delete'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
