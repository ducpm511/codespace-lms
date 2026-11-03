-- Đóng gate còn mở của những bài mà khóa đã bị gỡ khỏi lớp.
-- Trước bản vá `ClassesService.removeCourse`, gỡ khóa chỉ xóa `class_courses`, gate vẫn isActive=true
-- nên học viên tiếp tục thấy và làm được bài của khóa đã gỡ. Chỉ đổi dữ liệu, không đổi schema.
-- Không đụng tiến độ/bài nộp: gán lại khóa và mở lại gate thì học viên thấy lại đúng tiến độ cũ.
UPDATE "lesson_gates" AS g
SET "isActive" = false,
    "activatedAt" = NULL,
    "activatedById" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE g."isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "lessons" AS l
    JOIN "sections" AS s ON s."id" = l."sectionId"
    JOIN "class_courses" AS cc ON cc."courseId" = s."courseId"
    WHERE l."id" = g."lessonId"
      AND cc."classId" = g."classId"
  );
