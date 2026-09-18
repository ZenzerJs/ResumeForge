-- CreateTable
CREATE TABLE "SystemInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "initializedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
