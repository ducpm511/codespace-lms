-- CreateEnum
CREATE TYPE "LessonActivityType" AS ENUM ('markdown', 'pdf', 'video', 'quiz', 'coding', 'assignment');

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "fileName" TEXT;

-- CreateTable
CREATE TABLE "lesson_activities" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "LessonActivityType" NOT NULL,
    "title" TEXT,
    "contentMd" TEXT,
    "fileId" TEXT,
    "videoUrl" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_activities_fileId_idx" ON "lesson_activities"("fileId");

-- CreateIndex
CREATE INDEX "lesson_activities_refId_idx" ON "lesson_activities"("refId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_activities_lessonId_order_key" ON "lesson_activities"("lessonId", "order");

-- AddForeignKey
ALTER TABLE "lesson_activities" ADD CONSTRAINT "lesson_activities_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_activities" ADD CONSTRAINT "lesson_activities_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Data migration (P7) ===
-- Backfill activity từ nội dung bài học cũ (Lesson.contentMd / Lesson.videoUrl) để tương thích ngược.
-- Cột legacy trên "lessons" được GIỮ NGUYÊN (không xoá dữ liệu) — FE chỉ dùng khi activities rỗng.
INSERT INTO "lesson_activities" ("id", "lessonId", "order", "type", "contentMd", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, l."id", 0, 'markdown'::"LessonActivityType", l."contentMd", NOW(), NOW()
FROM "lessons" l
WHERE l."contentMd" IS NOT NULL AND btrim(l."contentMd") <> '';

INSERT INTO "lesson_activities" ("id", "lessonId", "order", "type", "videoUrl", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, l."id",
       CASE WHEN l."contentMd" IS NOT NULL AND btrim(l."contentMd") <> '' THEN 1 ELSE 0 END,
       'video'::"LessonActivityType", l."videoUrl", NOW(), NOW()
FROM "lessons" l
WHERE l."videoUrl" IS NOT NULL AND btrim(l."videoUrl") <> '';
