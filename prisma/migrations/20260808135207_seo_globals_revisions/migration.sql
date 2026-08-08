-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "description" TEXT,
ADD COLUMN     "noIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialImage" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "faviconData" TEXT,
ADD COLUMN     "footerTree" JSONB,
ADD COLUMN     "headerTree" JSONB,
ADD COLUMN     "publishedFooterTree" JSONB,
ADD COLUMN     "publishedHeaderTree" JSONB;

-- CreateTable
CREATE TABLE "PageRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "label" TEXT,
    "tree" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageRevision_pageId_createdAt_idx" ON "PageRevision"("pageId", "createdAt");

-- AddForeignKey
ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
