-- P11 T11.7: BlockSpace trong bài học / bài tập. Thêm giá trị enum (không dùng trong cùng transaction),
-- cột mới đều NULL được — không đụng dữ liệu cũ.

-- AlterEnum
ALTER TYPE "LessonActivityType" ADD VALUE 'scratch';

-- AlterEnum
ALTER TYPE "SubmissionType" ADD VALUE 'scratch';

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "scratchChecks" JSONB;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "scratchVersionId" TEXT;

-- CreateTable
CREATE TABLE "scratch_activity_copies" (
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_activity_copies_pkey" PRIMARY KEY ("activityId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "scratch_activity_copies_projectId_key" ON "scratch_activity_copies"("projectId");

-- CreateIndex
CREATE INDEX "scratch_activity_copies_userId_idx" ON "scratch_activity_copies"("userId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_scratchVersionId_fkey" FOREIGN KEY ("scratchVersionId") REFERENCES "scratch_project_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_activity_copies" ADD CONSTRAINT "scratch_activity_copies_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "lesson_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_activity_copies" ADD CONSTRAINT "scratch_activity_copies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_activity_copies" ADD CONSTRAINT "scratch_activity_copies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

