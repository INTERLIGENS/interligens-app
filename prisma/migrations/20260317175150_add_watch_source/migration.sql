-- CreateTable
CREATE TABLE "WatchSource" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "investigator" TEXT NOT NULL DEFAULT '@david',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    "lastHash" TEXT,
    "lastIntakeId" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WatchSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchSource_url_key" ON "WatchSource"("url");
