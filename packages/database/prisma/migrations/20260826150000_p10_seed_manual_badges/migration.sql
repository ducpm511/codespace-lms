-- === Data migration (P10 / T10.3) ===
-- Ba huy hiệu giáo viên trao tay.
--
-- Vì sao nằm ở migration chứ không chỉ ở `seed.cjs`: `ops/release.sh` chạy `prisma migrate deploy`
-- nhưng KHÔNG chạy seed — seed chỉ chạy đúng một lần lúc dựng máy (RUNBOOK §2). Để nguyên ở seed
-- thì ô chọn huy hiệu của T10.3 sẽ RỖNG trên production và không có gì báo lỗi cả.
--
-- Idempotent: chạy lại không nhân bản, và không ghi đè huy hiệu đã có (giáo viên có thể đã đổi tên
-- hoặc icon). `seed.cjs` vẫn giữ ba huy hiệu này cho môi trường dựng mới từ đầu.
INSERT INTO "badges" (id, code, name, description, icon, "isManual", "createdAt") VALUES
  ('badge_helping_hand',  'helping_hand',  'Giúp bạn',          'Chủ động giúp bạn trong lớp học',           'ph-hand-heart', true, CURRENT_TIMESTAMP),
  ('badge_good_question', 'good_question', 'Câu hỏi hay',       'Đặt câu hỏi hay, làm cả lớp cùng hiểu ra',  'ph-lightbulb',  true, CURRENT_TIMESTAMP),
  ('badge_big_progress',  'big_progress',  'Tiến bộ vượt bậc',  'Tiến bộ rõ rệt so với chính mình',          'ph-trend-up',   true, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
