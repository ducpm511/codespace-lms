-- P11: ba lô (backpack) của trình soạn BlockSpace — kho riêng mỗi người (nhân vật, trang phục, âm thanh, khối lệnh).
-- Nội dung là bản sao ở storage private (storageKey), không tham chiếu scratch_assets.

-- CreateEnum
CREATE TYPE "ScratchBackpackItemType" AS ENUM ('costume', 'sound', 'script', 'sprite');

-- CreateTable
CREATE TABLE "scratch_backpack_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ScratchBackpackItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "md5ext" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "thumbnail" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_backpack_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scratch_backpack_items_userId_createdAt_idx" ON "scratch_backpack_items"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "scratch_backpack_items" ADD CONSTRAINT "scratch_backpack_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
