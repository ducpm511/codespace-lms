-- CreateEnum
CREATE TYPE "ScratchPublicationDecision" AS ENUM ('approved', 'rejected', 'removed', 'withdrawn');

-- CreateEnum
CREATE TYPE "ScratchReportReason" AS ENUM ('inappropriate', 'personal_info', 'copied', 'other');

-- CreateEnum
CREATE TYPE "ScratchReportResolution" AS ENUM ('dismissed', 'removed');

-- CreateTable
CREATE TABLE "scratch_publications" (
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publishedVersionId" TEXT,
    "publishedTitle" TEXT,
    "publishedAt" TIMESTAMP(3),
    "requestedVersionId" TEXT,
    "requestedAt" TIMESTAMP(3),
    "decision" "ScratchPublicationDecision",
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scratch_publications_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "scratch_nicknames" (
    "userId" TEXT NOT NULL,
    "approved" TEXT,
    "pending" TEXT,
    "pendingAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scratch_nicknames_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "scratch_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ScratchReportReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" "ScratchReportResolution",

    CONSTRAINT "scratch_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scratch_publications_slug_key" ON "scratch_publications"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "scratch_publications_publishedVersionId_key" ON "scratch_publications"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "scratch_publications_requestedVersionId_key" ON "scratch_publications"("requestedVersionId");

-- CreateIndex
CREATE INDEX "scratch_publications_requestedAt_idx" ON "scratch_publications"("requestedAt");

-- CreateIndex
CREATE INDEX "scratch_nicknames_pendingAt_idx" ON "scratch_nicknames"("pendingAt");

-- CreateIndex
CREATE INDEX "scratch_reports_resolvedAt_createdAt_idx" ON "scratch_reports"("resolvedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scratch_reports_projectId_reporterId_key" ON "scratch_reports"("projectId", "reporterId");

-- AddForeignKey
ALTER TABLE "scratch_publications" ADD CONSTRAINT "scratch_publications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_publications" ADD CONSTRAINT "scratch_publications_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "scratch_project_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_publications" ADD CONSTRAINT "scratch_publications_requestedVersionId_fkey" FOREIGN KEY ("requestedVersionId") REFERENCES "scratch_project_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_publications" ADD CONSTRAINT "scratch_publications_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_nicknames" ADD CONSTRAINT "scratch_nicknames_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_nicknames" ADD CONSTRAINT "scratch_nicknames_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_reports" ADD CONSTRAINT "scratch_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_reports" ADD CONSTRAINT "scratch_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_reports" ADD CONSTRAINT "scratch_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === Data migration — quyền `scratch.moderate` cho admin + super_admin ===
--
-- Kiểm duyệt BlockSpace toàn trường (duyệt/gỡ công khai, xử lý báo cáo, duyệt biệt danh). GV KHÔNG cần
-- quyền này: GV kiểm duyệt học viên lớp mình theo quan hệ lớp. Nằm ở migration vì `ops/release.sh` chạy
-- `migrate deploy` mà KHÔNG chạy seed (xem 20260826180000_instructor_can_delete_course).
-- Idempotent: chạy lại không nhân bản; thiếu role thì không chèn dòng nào.
INSERT INTO "permissions" (id, key, description, "createdAt")
VALUES ('perm_scratch_moderate', 'scratch.moderate', 'Kiểm duyệt BlockSpace toàn trường (công khai, báo cáo, biệt danh)', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

INSERT INTO "role_permissions" (id, "roleId", "permissionId")
SELECT 'rp_' || r.key || '_scratch_moderate', r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.key IN ('admin', 'super_admin') AND p.key = 'scratch.moderate'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
