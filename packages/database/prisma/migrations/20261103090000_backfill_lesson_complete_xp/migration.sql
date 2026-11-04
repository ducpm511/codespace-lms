-- Bù XP `lesson_complete` cho những bài đã completed mà chưa từng được cộng.
-- Trước bản vá C3, pass bài lập trình/trắc nghiệm tự đặt bài học thành completed mà không cộng XP này,
-- rồi nút Hoàn thành bị khóa nên học viên không còn cách nào tự nhận. Chỉ đổi dữ liệu, không đổi schema.
-- Giữ nguyên trạng thái completed: hạ về in_progress sẽ làm học viên tụt tiến độ và mốc chứng chỉ.
--
-- Một bài học ở nhiều lớp chỉ được một dòng, đúng khoá chống farm (userId, source, sourceId); lấy lớp hoàn
-- thành sớm nhất. `createdAt` là lúc hoàn thành để XP về đúng tuần cũ, không lật bảng xếp hạng tuần này.
-- 50 khớp `XP_REWARDS.lesson_complete`. ON CONFLICT giúp chạy lại không cộng lần hai.
-- Không chạm streak/huy hiệu/thông báo: `first_lesson` sẽ được trao ở lần hoàn thành bài kế tiếp.
INSERT INTO "xp_events" ("id", "userId", "source", "sourceId", "amount", "classId", "createdAt")
SELECT DISTINCT ON (p."userId", p."lessonId")
  gen_random_uuid()::text,
  p."userId",
  'lesson_complete',
  p."lessonId",
  50,
  p."classId",
  COALESCE(p."completedAt", p."updatedAt")
FROM "lesson_progress" AS p
WHERE p."status" = 'completed'
ORDER BY p."userId", p."lessonId", p."completedAt" ASC NULLS LAST, p."classId" ASC
ON CONFLICT ("userId", "source", "sourceId") DO NOTHING;
