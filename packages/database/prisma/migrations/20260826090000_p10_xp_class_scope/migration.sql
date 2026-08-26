-- AlterTable
ALTER TABLE "xp_events" ADD COLUMN     "classId" TEXT;

-- CreateIndex
CREATE INDEX "xp_events_classId_createdAt_idx" ON "xp_events"("classId", "createdAt");

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Data migration (P10 / T10.1) ===
-- Gắn lớp cho XP đã ghi trước P10. Suy ra từ chính sự kiện domain sinh ra XP đó:
--   lesson_complete -> lesson_progress(userId, lessonId) đã completed
--   quiz_pass       -> quiz_attempts(userId, quizId) đã submitted
--   coding_pass     -> coding_submissions(userId, problemId) đã passed
-- Học viên có thể học cùng một bài ở NHIỀU lớp; khi đó không có câu trả lời đúng duy nhất —
-- chọn bản ghi gần thời điểm cộng XP nhất, hoà thì lấy lớp vào sớm nhất (ORDER BY tất định).
-- Suy không ra thì để NULL: bảng xếp hạng bỏ qua, KHÔNG đoán bừa.

UPDATE "xp_events" x
SET "classId" = (
  SELECT lp."classId"
  FROM "lesson_progress" lp
  WHERE lp."userId" = x."userId"
    AND lp."lessonId" = x."sourceId"
    AND lp."status" = 'completed'
  ORDER BY abs(extract(epoch FROM (COALESCE(lp."completedAt", lp."updatedAt") - x."createdAt"))), lp."createdAt", lp."id"
  LIMIT 1
)
WHERE x."source" = 'lesson_complete' AND x."classId" IS NULL;

UPDATE "xp_events" x
SET "classId" = (
  SELECT qa."classId"
  FROM "quiz_attempts" qa
  WHERE qa."userId" = x."userId"
    AND qa."quizId" = x."sourceId"
    AND qa."classId" IS NOT NULL
    AND qa."status" = 'submitted'
  ORDER BY abs(extract(epoch FROM (COALESCE(qa."submittedAt", qa."createdAt") - x."createdAt"))), qa."createdAt", qa."id"
  LIMIT 1
)
WHERE x."source" = 'quiz_pass' AND x."classId" IS NULL;

UPDATE "xp_events" x
SET "classId" = (
  SELECT cs."classId"
  FROM "coding_submissions" cs
  WHERE cs."userId" = x."userId"
    AND cs."problemId" = x."sourceId"
    AND cs."classId" IS NOT NULL
    AND cs."status" = 'passed'
  ORDER BY abs(extract(epoch FROM (cs."submittedAt" - x."createdAt"))), cs."createdAt", cs."id"
  LIMIT 1
)
WHERE x."source" = 'coding_pass' AND x."classId" IS NULL;
