/*
  Warnings:

  - Added the required column `sourceName` to the `SourceRegistry` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SourceRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handle" TEXT,
    "sourceName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'other',
    "url" TEXT,
    "homepageUrl" TEXT,
    "description" TEXT,
    "defaultChain" TEXT,
    "defaultLabelType" TEXT,
    "defaultLabel" TEXT,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'internal_only',
    "license" TEXT,
    "tosRisk" TEXT NOT NULL DEFAULT 'low',
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SourceRegistry" ("createdAt", "description", "id", "license", "name", "tosRisk", "trusted", "updatedAt", "url") SELECT "createdAt", "description", "id", "license", "name", "tosRisk", "trusted", "updatedAt", "url" FROM "SourceRegistry";
DROP TABLE "SourceRegistry";
ALTER TABLE "new_SourceRegistry" RENAME TO "SourceRegistry";
CREATE UNIQUE INDEX "SourceRegistry_handle_key" ON "SourceRegistry"("handle");
CREATE UNIQUE INDEX "SourceRegistry_name_key" ON "SourceRegistry"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
