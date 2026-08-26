-- AlterTable
ALTER TABLE "badges" ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user_badges" ADD COLUMN     "awardedById" TEXT,
ADD COLUMN     "classId" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "xp_events" ADD COLUMN     "note" TEXT;

-- CreateIndex
CREATE INDEX "user_badges_classId_idx" ON "user_badges"("classId");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
