/*
  Warnings:

  - You are about to drop the column `sessionId_unique` on the `SessionExecutionLog` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `WhatsAppMessageLog` table. All the data in the column will be lost.
  - Added the required column `templateName` to the `WhatsAppMessageLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "MonthlyScheduleCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministryId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'coletando_disponibilidade',
    "availabilityDeadline" DATETIME NOT NULL,
    CONSTRAINT "MonthlyScheduleCycle_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MinistryConfig" (
    "ministryId" TEXT NOT NULL PRIMARY KEY,
    "defaultFormation" TEXT NOT NULL DEFAULT '[]',
    "availabilityDeadlineDays" INTEGER NOT NULL DEFAULT 5,
    "substitutionWindowHours" INTEGER NOT NULL DEFAULT 4,
    "cycleTriggerDay" INTEGER NOT NULL DEFAULT 20,
    CONSTRAINT "MinistryConfig_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Musician" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "worshipRoles" TEXT NOT NULL DEFAULT '[]',
    "whatsappPhone" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Musician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Musician_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Musician" ("createdAt", "id", "instrument", "ministryId", "userId") SELECT "createdAt", "id", "instrument", "ministryId", "userId" FROM "Musician";
DROP TABLE "Musician";
ALTER TABLE "new_Musician" RENAME TO "Musician";
CREATE INDEX "Musician_ministryId_idx" ON "Musician"("ministryId");
CREATE TABLE "new_ServiceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "musicianId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmado',
    "substitutionOf" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" DATETIME,
    CONSTRAINT "ServiceAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ServiceSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceAssignment_musicianId_fkey" FOREIGN KEY ("musicianId") REFERENCES "Musician" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceAssignment" ("confirmed", "confirmedAt", "id", "role", "scheduleId", "userId") SELECT "confirmed", "confirmedAt", "id", "role", "scheduleId", "userId" FROM "ServiceAssignment";
DROP TABLE "ServiceAssignment";
ALTER TABLE "new_ServiceAssignment" RENAME TO "ServiceAssignment";
CREATE INDEX "ServiceAssignment_scheduleId_status_idx" ON "ServiceAssignment"("scheduleId", "status");
CREATE INDEX "ServiceAssignment_musicianId_status_idx" ON "ServiceAssignment"("musicianId", "status");
CREATE TABLE "new_SessionExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasOverride" BOOLEAN NOT NULL DEFAULT false,
    "triggeredByUserId" TEXT NOT NULL,
    "durationSeconds" REAL,
    CONSTRAINT "SessionExecutionLog_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "CueBlock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SessionExecutionLog_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SessionExecutionLog" ("blockId", "durationSeconds", "id", "sessionId", "triggeredAt", "triggeredByUserId", "wasOverride") SELECT "blockId", "durationSeconds", "id", "sessionId", "triggeredAt", "triggeredByUserId", "wasOverride" FROM "SessionExecutionLog";
DROP TABLE "SessionExecutionLog";
ALTER TABLE "new_SessionExecutionLog" RENAME TO "SessionExecutionLog";
CREATE TABLE "new_WhatsAppMessageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministryId" TEXT NOT NULL,
    "musicianId" TEXT,
    "sentById" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '{}',
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "responsePayload" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessageLog_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppMessageLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppMessageLog" ("id", "ministryId", "sentAt", "sentById") SELECT "id", "ministryId", "sentAt", "sentById" FROM "WhatsAppMessageLog";
DROP TABLE "WhatsAppMessageLog";
ALTER TABLE "new_WhatsAppMessageLog" RENAME TO "WhatsAppMessageLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
