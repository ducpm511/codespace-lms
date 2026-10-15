-- P11 T11.8: bình luận BlockSpace (ADR D8) + báo cáo bình luận + danh sách từ cấm (admin sửa trên web).

-- AlterTable
ALTER TABLE "scratch_projects" ADD COLUMN     "commentsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "scratch_comments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scratch_comment_reports" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ScratchReportReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "scratch_comment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scratch_banned_words" (
    "word" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_banned_words_pkey" PRIMARY KEY ("word")
);

-- CreateIndex
CREATE INDEX "scratch_comments_projectId_createdAt_idx" ON "scratch_comments"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "scratch_comments_authorId_createdAt_idx" ON "scratch_comments"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "scratch_comment_reports_resolvedAt_createdAt_idx" ON "scratch_comment_reports"("resolvedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scratch_comment_reports_commentId_reporterId_key" ON "scratch_comment_reports"("commentId", "reporterId");

-- AddForeignKey
ALTER TABLE "scratch_comments" ADD CONSTRAINT "scratch_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_comments" ADD CONSTRAINT "scratch_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_comments" ADD CONSTRAINT "scratch_comments_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_comments" ADD CONSTRAINT "scratch_comments_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_comment_reports" ADD CONSTRAINT "scratch_comment_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "scratch_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_comment_reports" ADD CONSTRAINT "scratch_comment_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_comment_reports" ADD CONSTRAINT "scratch_comment_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_banned_words" ADD CONSTRAINT "scratch_banned_words_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Danh sách từ cấm MẶC ĐỊNH (cơ bản, chữ thường, NFC). Admin thêm / bớt ở trang Kiểm duyệt BlockSpace.
-- Khớp theo TỪ NGUYÊN VẸN (không phải chuỗi con) nên "lon" / "cac" không dính "lồn" / "cặc".
INSERT INTO "scratch_banned_words" ("word") VALUES
  ('đm'), ('đmm'), ('dm'), ('dmm'), ('đcm'), ('dcm'), ('vcl'), ('vkl'), ('vãi lồn'), ('đéo'), ('địt'),
  ('lồn'), ('cặc'), ('buồi'), ('đĩ'), ('óc chó'), ('thằng ngu'), ('con ngu'), ('mày ngu'),
  ('fuck'), ('fucking'), ('shit'), ('bitch'), ('asshole')
ON CONFLICT DO NOTHING;
