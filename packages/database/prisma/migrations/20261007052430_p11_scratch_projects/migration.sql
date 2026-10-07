-- CreateEnum
CREATE TYPE "ScratchVisibility" AS ENUM ('private', 'class', 'school', 'public');

-- CreateTable
CREATE TABLE "scratch_projects" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" "ScratchVisibility" NOT NULL DEFAULT 'private',
    "classId" TEXT,
    "remixOfId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scratch_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scratch_project_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "projectJson" JSONB NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "savedById" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scratch_assets" (
    "md5ext" TEXT NOT NULL,
    "dataFormat" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_assets_pkey" PRIMARY KEY ("md5ext")
);

-- CreateTable
CREATE TABLE "scratch_project_assets" (
    "projectId" TEXT NOT NULL,
    "md5ext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_project_assets_pkey" PRIMARY KEY ("projectId","md5ext")
);

-- CreateTable
CREATE TABLE "scratch_collaborators" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_collaborators_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "scratch_project_likes" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_project_likes_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE INDEX "scratch_projects_ownerId_deletedAt_updatedAt_idx" ON "scratch_projects"("ownerId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "scratch_projects_classId_visibility_idx" ON "scratch_projects"("classId", "visibility");

-- CreateIndex
CREATE INDEX "scratch_projects_remixOfId_idx" ON "scratch_projects"("remixOfId");

-- CreateIndex
CREATE INDEX "scratch_project_versions_projectId_frozenAt_idx" ON "scratch_project_versions"("projectId", "frozenAt");

-- CreateIndex
CREATE UNIQUE INDEX "scratch_project_versions_projectId_seq_key" ON "scratch_project_versions"("projectId", "seq");

-- CreateIndex
CREATE INDEX "scratch_assets_uploadedById_idx" ON "scratch_assets"("uploadedById");

-- CreateIndex
CREATE INDEX "scratch_project_assets_md5ext_idx" ON "scratch_project_assets"("md5ext");

-- CreateIndex
CREATE INDEX "scratch_collaborators_userId_idx" ON "scratch_collaborators"("userId");

-- CreateIndex
CREATE INDEX "scratch_project_likes_userId_idx" ON "scratch_project_likes"("userId");

-- AddForeignKey
ALTER TABLE "scratch_projects" ADD CONSTRAINT "scratch_projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_projects" ADD CONSTRAINT "scratch_projects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_projects" ADD CONSTRAINT "scratch_projects_remixOfId_fkey" FOREIGN KEY ("remixOfId") REFERENCES "scratch_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_project_versions" ADD CONSTRAINT "scratch_project_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_project_versions" ADD CONSTRAINT "scratch_project_versions_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_assets" ADD CONSTRAINT "scratch_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_project_assets" ADD CONSTRAINT "scratch_project_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_project_assets" ADD CONSTRAINT "scratch_project_assets_md5ext_fkey" FOREIGN KEY ("md5ext") REFERENCES "scratch_assets"("md5ext") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_collaborators" ADD CONSTRAINT "scratch_collaborators_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_collaborators" ADD CONSTRAINT "scratch_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_collaborators" ADD CONSTRAINT "scratch_collaborators_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_project_likes" ADD CONSTRAINT "scratch_project_likes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "scratch_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_project_likes" ADD CONSTRAINT "scratch_project_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
